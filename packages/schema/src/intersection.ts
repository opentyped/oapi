import type ts from 'typescript';
import { tryParsePointer } from '@opentyped/oapi-openapi/pointer';
import { SCHEMA_ANNOTATIONS } from '@opentyped/oapi-openapi/schema/graph';
import { visitSchema } from '@opentyped/oapi-openapi/schema/visitor';
import type { Schema } from '~/definition';
import { SchemaError } from '~/error';
import { schemaReference } from '~/destination';

interface Resolved {
  schema: Schema;
  reference: string | undefined;
  assertions: Schema[];
}
interface Pair {
  name?: string;
  schema?: Schema;
}

/** Combine structural shapes before closing their shared fields or array positions. */
export class SchemaIntersection {
  private readonly pairs = new Map<string, Pair>();
  private unionBranches = 0;

  constructor(
    private readonly definitions: Record<string, Schema>,
    private readonly pending: Set<string>,
    private readonly reserve: (name: string, node: ts.Node) => void,
    private readonly maxPairs = 10_000,
    private readonly path: readonly string[] = ['$defs'],
    private readonly generatedName: (preferred: string) => string = (preferred) => preferred,
  ) {}

  apply(left: Schema, right: Schema, node: ts.Node, depth = 0): Schema {
    if (depth >= 128) throw new SchemaError('Object intersection exceeds 128 nested shapes', node);
    if (left === right) return left;
    if (left === false || right === false) return false;
    if (left === true) return right;
    if (right === true) return left;
    if (
      typeof left.$ref === 'string' &&
      left.$ref === right.$ref &&
      Object.keys(left).length === 1 &&
      Object.keys(right).length === 1
    )
      return left;
    const a = this.resolve(left, node);
    const b = this.resolve(right, node);
    if (a.schema === false || b.schema === false) return false;
    if (typeof a.schema !== 'object' || typeof b.schema !== 'object')
      return { allOf: [left, right], ...SchemaIntersection.metadata([left, right], node) };
    const union = [a, b].find(
      (value) =>
        typeof value.schema === 'object' &&
        Array.isArray(value.schema.anyOf) &&
        Object.keys(value.schema).length === 1 &&
        !value.assertions.length,
    );
    if (union && typeof union.schema === 'object') {
      this.movable(union.schema, node);
      const branches = union.schema.anyOf as Schema[];
      this.unionBranches += branches.length;
      if (branches.length > 128 || this.unionBranches > this.maxPairs)
        throw new SchemaError('Structural union intersection exceeds its branch budget', node);
      const other = union === a ? right : left;
      const values = branches
        .map((branch) => this.apply(branch, other, node, depth + 1))
        .filter((branch) => branch !== false);
      return values.length === 0 ? false : values.length === 1 ? values[0]! : { anyOf: values };
    }
    const kind = a.schema.type;
    if (
      typeof kind === 'string' &&
      typeof b.schema.type === 'string' &&
      kind !== b.schema.type &&
      ![kind, b.schema.type].every((value) => value === 'integer' || value === 'number')
    )
      return false;
    if ((kind !== 'object' && kind !== 'array') || kind !== b.schema.type) {
      if (
        [a.schema, b.schema].some(
          (schema) => schema.type === 'object' || schema.type === 'array',
        ) &&
        [a.schema, b.schema].some((schema) =>
          ['$ref', '$dynamicRef', 'allOf', 'anyOf', 'oneOf'].some((key) => key in schema),
        )
      )
        throw new SchemaError(
          'Structural intersection requires concrete shapes without combinators',
          node,
        );
      return {
        allOf: [left, right],
        ...SchemaIntersection.metadata(
          [...a.assertions, ...b.assertions, a.schema, b.schema],
          node,
        ),
      };
    }
    const combine = (): Schema =>
      this.combine(
        a.schema as Exclude<Schema, boolean>,
        b.schema as Exclude<Schema, boolean>,
        node,
        depth,
      );
    const schema =
      a.reference && b.reference && a.reference !== b.reference
        ? this.pair([a.reference, b.reference].sort(), combine, node)
        : combine();
    const assertions = [...a.assertions, ...b.assertions];
    return assertions.length && schema !== false
      ? {
          ...(typeof schema === 'object' ? schema : {}),
          ...SchemaIntersection.metadata([...a.assertions, ...b.assertions, schema], node),
          allOf: [
            ...(typeof schema === 'object' ? ((schema.allOf as Schema[] | undefined) ?? []) : []),
            ...assertions,
          ],
        }
      : schema;
  }

  private pair(references: string[], combine: () => Schema, node: ts.Node): Schema {
    const key = JSON.stringify(references);
    const previous = this.pairs.get(key);
    if (previous) {
      if (previous.schema !== undefined) return previous.schema;
      if (!previous.name) {
        const name = this.generatedName(
          'Intersection.' +
            references
              .map((ref) => {
                const parts = tryParsePointer(ref);
                if (!parts)
                  throw new SchemaError(`Cannot name intersection reference '${ref}'`, node);
                return parts.slice(this.path.length).join('.');
              })
              .join('.And.'),
        );
        this.reserve(name, node);
        if (Object.hasOwn(this.definitions, name))
          throw new SchemaError(`Intersection schema name '${name}' is already occupied`, node);
        previous.name = name;
        this.definitions[name] = false;
        this.pending.add(name);
      }
      return { $ref: schemaReference(previous.name, this.path) };
    }
    if (this.pairs.size >= this.maxPairs)
      throw new SchemaError(
        `Intersection exceeded ${this.maxPairs} active or recursive pairs`,
        node,
      );
    const pair: Pair = {};
    this.pairs.set(key, pair);
    try {
      const schema = combine();
      if (!pair.name) {
        this.pairs.delete(key);
        return schema;
      }
      this.definitions[pair.name] = schema;
      this.pending.delete(pair.name);
      pair.schema = { $ref: schemaReference(pair.name, this.path) };
      return pair.schema;
    } catch (error) {
      this.pairs.delete(key);
      if (pair.name) {
        delete this.definitions[pair.name];
        this.pending.delete(pair.name);
      }
      throw error;
    }
  }

  private combine(
    a: Exclude<Schema, boolean>,
    b: Exclude<Schema, boolean>,
    node: ts.Node,
    depth: number,
  ): Schema {
    for (const schema of [a, b]) {
      if (
        ['$ref', 'allOf', 'anyOf', 'oneOf', 'patternProperties', 'unevaluatedProperties'].some(
          (key) => key in schema,
        )
      )
        throw new SchemaError(
          'Object intersection requires a concrete shape without resource scopes',
          node,
        );
      this.movable(schema, node);
    }
    if (a.type === 'array') return this.arrays(a, b, node, depth);
    const first = (a.properties ?? {}) as Record<string, Schema>;
    const second = (b.properties ?? {}) as Record<string, Schema>;
    const properties = Object.assign(Object.create(null), first) as Record<string, Schema>;
    for (const [name, value] of Object.entries(second))
      properties[name] = Object.hasOwn(first, name)
        ? this.apply(first[name]!, value, node, depth + 1)
        : value;
    const assertions = [a, b]
      .map((schema) =>
        Object.fromEntries(
          Object.entries(schema).filter(
            ([key]) =>
              !['type', 'properties', 'required', 'additionalProperties'].includes(key) &&
              !SCHEMA_ANNOTATIONS.has(key) &&
              !key.startsWith('x-'),
          ),
        ),
      )
      .filter((schema) => Object.keys(schema).length);
    const required = [
      ...new Set([...((a.required ?? []) as string[]), ...((b.required ?? []) as string[])]),
    ];
    return {
      type: 'object',
      ...SchemaIntersection.metadata([a, b], node),
      properties,
      ...(required.length ? { required } : {}),
      additionalProperties:
        a.additionalProperties === false || b.additionalProperties === false
          ? false
          : this.apply(
              (a.additionalProperties ?? true) as Schema,
              (b.additionalProperties ?? true) as Schema,
              node,
              depth + 1,
            ),
      ...(assertions.length ? { allOf: assertions } : {}),
    };
  }

  static metadata(schemas: Schema[], node: ts.Node): Record<string, unknown> {
    const metadata: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    const entries = schemas.flatMap((schema) =>
      typeof schema === 'object' ? Object.entries(schema) : [],
    );
    for (const [key, value] of entries) {
      if (!SCHEMA_ANNOTATIONS.has(key) && !key.startsWith('x-')) continue;
      if (key === 'http' && Object.hasOwn(metadata, key)) {
        const previous = metadata.http;
        if (!previous || typeof previous !== 'object' || !value || typeof value !== 'object')
          throw new SchemaError('Intersected HTTP metadata must be objects', node);
        for (const [name, item] of Object.entries(value))
          if (
            Object.hasOwn(previous, name) &&
            JSON.stringify((previous as Record<string, unknown>)[name]) !== JSON.stringify(item)
          )
            throw new SchemaError(`Conflicting HTTP metadata for ${name} in intersection`, node);
        metadata.http = { ...previous, ...value };
      } else if (!Object.hasOwn(metadata, key)) metadata[key] = value;
    }
    return metadata;
  }

  private movable(schema: Schema, node: ts.Node): void {
    visitSchema(schema, (value) => {
      if (
        typeof value === 'object' &&
        ['$id', '$anchor', '$dynamicAnchor', '$dynamicRef', '$defs'].some((key) => key in value)
      )
        throw new SchemaError('Structural intersection cannot move schema resource scopes', node);
    });
  }

  private arrays(
    a: Exclude<Schema, boolean>,
    b: Exclude<Schema, boolean>,
    node: ts.Node,
    depth: number,
  ): Schema {
    const first = (a.prefixItems ?? []) as Schema[];
    const second = (b.prefixItems ?? []) as Schema[];
    const prefixItems = Array.from({ length: Math.max(first.length, second.length) }, (_, index) =>
      this.apply(
        first[index] ?? (a.items as Schema | undefined) ?? true,
        second[index] ?? (b.items as Schema | undefined) ?? true,
        node,
        depth + 1,
      ),
    );
    const minItems = Math.max(
      (a.minItems as number | undefined) ?? 0,
      (b.minItems as number | undefined) ?? 0,
    );
    const maximum = Math.min(
      (a.maxItems as number | undefined) ?? Infinity,
      (b.maxItems as number | undefined) ?? Infinity,
    );
    if (minItems > maximum) return false;
    const assertions = [a, b]
      .map((schema) =>
        Object.fromEntries(
          Object.entries(schema).filter(
            ([key]) =>
              !['type', 'prefixItems', 'items', 'minItems', 'maxItems'].includes(key) &&
              !SCHEMA_ANNOTATIONS.has(key) &&
              !key.startsWith('x-'),
          ),
        ),
      )
      .filter((schema) => Object.keys(schema).length);
    return {
      type: 'array',
      ...SchemaIntersection.metadata([a, b], node),
      ...(prefixItems.length ? { prefixItems } : {}),
      items: this.apply(
        (a.items as Schema | undefined) ?? true,
        (b.items as Schema | undefined) ?? true,
        node,
        depth + 1,
      ),
      ...(minItems ? { minItems } : {}),
      ...(Number.isFinite(maximum) ? { maxItems: maximum } : {}),
      ...(assertions.length ? { allOf: assertions } : {}),
    };
  }

  private resolve(schema: Schema, node: ts.Node): Resolved {
    let reference: string | undefined;
    const assertions: Schema[] = [];
    const seen = new Set<string>();
    while (typeof schema === 'object' && typeof schema.$ref === 'string') {
      const ref = schema.$ref;
      if (!ref.startsWith('#')) break;
      const tokens = tryParsePointer(ref);
      if (!tokens) break;
      if (
        tokens.length !== this.path.length + 1 ||
        !this.path.every((token, index) => tokens[index] === token)
      )
        break;
      const name = tokens.at(-1)!;
      if (seen.has(name))
        throw new SchemaError(
          'Structural intersection cannot resolve a circular reference alias',
          node,
        );
      seen.add(name);
      if (this.pending.has(name))
        throw new SchemaError(
          'Recursive object intersection requires a completed named shape',
          node,
        );
      const target = this.definitions[name];
      if (target === undefined) break;
      reference ??= schemaReference(name, this.path);
      const siblings = Object.fromEntries(Object.entries(schema).filter(([key]) => key !== '$ref'));
      if (Object.keys(siblings).length) assertions.push(siblings);
      schema = target;
    }
    if (typeof schema === 'object' && (schema.type === 'object' || schema.type === 'array')) {
      const bounds =
        schema.type === 'array'
          ? new Set(['minItems', 'maxItems', 'uniqueItems'])
          : new Set(['minProperties', 'maxProperties']);
      for (const assertion of assertions) this.assertion(assertion, bounds, node);
    }
    return { schema, reference, assertions };
  }

  private assertion(schema: Schema, bounds: ReadonlySet<string>, node: ts.Node): void {
    if (typeof schema !== 'object')
      throw new SchemaError(
        'Structural reference assertions require a scope-preserving intersection',
        node,
      );
    for (const [key, value] of Object.entries(schema)) {
      if (key === 'allOf' && Array.isArray(value)) {
        for (const child of value) this.assertion(child as Schema, bounds, node);
      } else if (!bounds.has(key) && !SCHEMA_ANNOTATIONS.has(key) && !key.startsWith('x-'))
        throw new SchemaError(
          'Structural reference assertions require a scope-preserving intersection',
          node,
        );
    }
  }
}
