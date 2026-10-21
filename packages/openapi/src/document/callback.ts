import { httpMethod, putOperation } from '~/document/operation';
import { createHash } from 'node:crypto';
import type { Source } from '~/diagnostic';
import type { Schema, Components } from '~/schema/definition';
import type { Callback, Operation, OperationContract } from '~/document/definition';
import { namedObjectSchema } from '~/schema/shape';
import { COMPONENTS, componentName, componentPath, pointer } from '~/schema/reference';
import { httpMetadata, extensions } from '~/document/metadata';

type Compile = (contract: OperationContract, method: string) => Operation;

/** Reserves callback components before descending, so recursive contracts stay finite references. */
export class CallbackRegistry {
  readonly callbacks: Record<string, Callback> = Object.create(null) as Record<string, Callback>;
  readonly operations: { operation: Operation; source: Source }[] = [];
  private readonly names = new WeakMap<Schema, string>();
  private depth = 0;

  constructor(
    private readonly components: Components,
    private readonly compiler: Compile,
  ) {}

  compile(schema: Schema, owner: string, source: Source): NonNullable<Operation['callbacks']> {
    const fields = this.fields(schema, source, 'Operation callbacks');
    return Object.fromEntries(
      Object.entries(fields).map(([name, value]) => [
        name,
        { $ref: '#/components/callbacks/' + pointer(this.callback(value, owner, name, source)) },
      ]),
    );
  }

  private fields(schema: Schema, source: Source, label: string): Record<string, Schema> {
    return namedObjectSchema(schema, this.components, source, label).properties ?? {};
  }

  private callback(schema: Schema, owner: string, label: string, source: Source): string {
    let identity = schema;
    let named: string | undefined;
    const seen = new Set<Schema>();
    while (identity.$ref && identity.http === undefined) {
      if (seen.has(identity))
        return source.fail('Circular callback schema aliases are unsupported.');
      seen.add(identity);
      if (!identity.$ref.startsWith(COMPONENTS))
        return source.fail(`Unexpected callback schema reference ${identity.$ref}.`);
      const path = componentPath(identity.$ref);
      if (path?.length !== 1)
        return source.fail(`Unexpected callback schema reference ${identity.$ref}.`);
      named = path[0]!;
      identity =
        (Object.hasOwn(this.components, named) ? this.components[named] : undefined) ??
        source.fail(`Unresolved callback schema ${named}.`);
    }
    const previous = this.names.get(identity);
    if (previous) return previous;
    if (this.depth >= 100 || Object.keys(this.callbacks).length >= 1000)
      return source.fail('Callback graph exceeds the generation budget.');
    const suffix = createHash('sha256')
      .update(JSON.stringify([owner, label]))
      .digest('hex')
      .slice(0, 16);
    const name = 'Callback.' + componentName(named ?? `${label}_${suffix}`);
    if (Object.hasOwn(this.callbacks, name))
      return source.fail(`Conflicting callback component ${name}.`);
    this.names.set(identity, name);
    const result: Callback = Object.create(null) as Callback;
    this.callbacks[name] = result;
    this.depth++;
    try {
      const expressions = this.fields(schema, source, `Callback ${label}`);
      if (!Object.keys(expressions).length)
        source.fail(`Callback ${label} requires a URL expression.`);
      const validator = new CallbackExpression(source);
      for (const [expression, path] of Object.entries(expressions)) {
        if (expression.startsWith('x-'))
          source.fail('Callback extension data belongs in @http metadata.');
        validator.validate(expression);
        const item: Callback[string] = {};
        for (const [token, contract] of Object.entries(
          this.fields(path, source, 'Callback Path Item'),
        )) {
          const method = httpMethod(token, source);
          const operation = this.operation(
            contract,
            `${name}_${method}_${createHash('sha256').update(expression).digest('hex').slice(0, 16)}`,
            source,
            method,
          );
          if (!putOperation(item, method, operation))
            source.fail(`Duplicate callback HTTP method ${method}.`);
          this.operations.push({ operation, source });
        }
        if (!Object.keys(item).length) source.fail(`Callback ${label} requires an HTTP method.`);
        Object.defineProperty(result, expression, {
          value: item,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      Object.assign(result, extensions(httpMetadata(schema, this.components, source, {})));
    } finally {
      this.depth--;
    }
    return name;
  }

  private operation(schema: Schema, name: string, source: Source, method: string): Operation {
    const values = httpMetadata(schema, this.components, source, {
      operationId: 'string',
      summary: 'string',
      description: 'string',
      tags: 'any',
      deprecated: 'boolean',
      security: 'any',
      externalDocs: 'object',
      servers: 'any',
    });
    const annotations = new Map<string, string>();
    for (const key of ['operationId', 'summary', 'description'])
      if (typeof values[key] === 'string') annotations.set(key, values[key]);
    if (values.tags !== undefined) {
      if (!Array.isArray(values.tags) || values.tags.some((tag) => typeof tag !== 'string'))
        source.fail('Callback operation tags must be an array of strings.');
    }
    if (values.deprecated !== undefined) annotations.set('deprecated', String(values.deprecated));
    for (const key of ['security', 'externalDocs', 'servers'])
      if (values[key] !== undefined) annotations.set(key, JSON.stringify(values[key]));
    annotations.set('extensions', JSON.stringify(extensions(values)));
    const result = this.compiler({ schema, name, source, annotations }, method);
    if (values.tags !== undefined) result.tags = values.tags as string[];
    return result;
  }
}

/** Validates the OAS runtime-expression grammar without evaluating application data. */
class CallbackExpression {
  constructor(private readonly source: Source) {}

  validate(value: string): void {
    if (!value) this.source.fail('Callback URL expressions must be nonempty.');
    if (value.startsWith('$')) return this.expression(value);
    const embedded = /\{([^{}]*)\}/g;
    for (const match of value.matchAll(embedded)) this.expression(match[1]!);
    const literal = value.replace(embedded, '');
    if (/[{}]/.test(literal)) this.source.fail(`Unbalanced callback URL expression ${value}.`);
    if (
      Array.from(literal).some(
        (character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
      ) ||
      /%(?![\da-f]{2})/i.test(literal)
    )
      this.source.fail(
        'Callback URL literals must use URI escaping for whitespace, controls and percent signs.',
      );
  }

  private expression(value: string): void {
    if (['$url', '$method', '$statusCode'].includes(value)) return;
    const match = /^\$(request|response)\.([\s\S]*)$/.exec(value);
    const source = match?.[2];
    if (source?.startsWith('header.') && /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(source.slice(7)))
      return;
    if (source && /^(query|path)\.[^{}]*$/.test(source)) return;
    if (source === 'body' || (source?.startsWith('body#') && this.pointer(source.slice(5)))) return;
    this.source.fail(`Invalid callback runtime expression ${value}.`);
  }

  private pointer(value: string): boolean {
    return (value === '' || value.startsWith('/')) && !/~(?![01])/.test(value);
  }
}
