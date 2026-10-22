import { visitDocument } from '@opentyped/openapi/document/visitor';
import { httpMethod } from '@opentyped/openapi/document/operation';
import { compileDocument } from '@opentyped/openapi/document/document';
import { mergePathItem } from '@opentyped/openapi/document/merge';
import { GenerationError } from '@opentyped/openapi/diagnostic';
import { stableJson } from '@opentyped/openapi/json';
import type { Parser } from '~/parser/parser';
import type { ParserContext } from '~/parser/context';

function combine(target: object, incoming: object, label: string): void {
  const entries = target as Record<string, unknown>;
  for (const [name, value] of Object.entries(incoming)) {
    if (Object.hasOwn(entries, name) && stableJson(entries[name]) !== stableJson(value))
      throw new GenerationError(`Conflicting ${label} ${name} from parser contributions.`);
    Object.defineProperty(entries, name, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
}

export class DocumentEmitter implements Parser {
  readonly name = 'document/openapi';
  readonly stage = 'document';
  parse(context: ParserContext): void {
    if (!context.compilation)
      throw new GenerationError('Document emission requires schema compilation.');
    const result = compileDocument(context.compilation, context.options, context.options.tsconfig);
    const earlier = { ...context.document };
    for (const [path, item] of Object.entries(earlier.paths)) {
      result.document.paths[path] ??= {};
      mergePathItem(result.document.paths[path]!, item, `path ${path} field`);
    }
    if (earlier.webhooks) {
      result.document.webhooks ??= Object.create(null) as NonNullable<typeof earlier.webhooks>;
      for (const [name, item] of Object.entries(earlier.webhooks)) {
        if (Object.hasOwn(result.document.webhooks, name))
          mergePathItem(result.document.webhooks[name]!, item, `webhook ${name} field`);
        else
          Object.defineProperty(result.document.webhooks, name, {
            value: item,
            writable: true,
            enumerable: true,
            configurable: true,
          });
      }
    }
    const components = result.document.components as Record<string, unknown>;
    for (const [section, entries] of Object.entries(earlier.components)) {
      if (section.startsWith('x-')) {
        combine(components, { [section]: entries }, 'component extension');
        continue;
      }
      components[section] ??= {};
      combine(components[section] as object, entries as object, `${section} component`);
    }
    Object.assign(context.document, result.document, earlier, {
      paths: result.document.paths,
      components: result.document.components,
      ...(result.document.webhooks ? { webhooks: result.document.webhooks } : {}),
    });
    Object.assign(context.schemas, result.schemas);
    this.assignNamespaces(context);
  }
  private assignNamespaces(context: ParserContext): void {
    const namespaces = new Map<string, string>();
    for (const declaration of context.declarations) {
      if (!declaration.emitOperation || !declaration.annotations.has('route')) continue;
      const namespace = context.identities.namespace?.(declaration.node);
      if (!namespace) continue;
      const id = declaration.annotations.get('operationId') ?? declaration.name;
      const route = declaration.annotations.get('route')!;
      const methods = route.split(/\s/, 1)[0]!.split(',');
      for (const method of methods) {
        const token = httpMethod(method, declaration.source);
        const operationId = methods.length === 1 ? id : `${id}_${token}`;
        namespaces.set(operationId, namespace.split('.').join('/'));
      }
    }
    visitDocument(context.document, {
      object(operation, role): void {
        if (role !== 'operationObject' || typeof operation.operationId !== 'string') return;
        const namespace = namespaces.get(operation.operationId);
        if (namespace) operation['x-opentyped-namespace'] = namespace;
      },
    });
  }
}
