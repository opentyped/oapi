import uriResolver from 'fast-uri';
import { absoluteSchema } from '~/schema/resource';
import { mapSchema } from '~/schema/visitor';
import { mapReferences, pointer } from '~/schema/reference';
import type { Schema } from '~/schema/definition';
import { tagNames } from '~/document/metadata';
import type { OpenApiDocument, PathItem } from '~/document/definition';
import { DocumentValidation } from '~/document/validation';
import { visitResolvedDocument, operationsOf } from '~/document/visitor';
import { GenerationError } from '~/diagnostic';
import { stableJson } from '~/json';
import { DocumentReferences, documentPointer } from '~/document/reference';

export interface DocumentPart {
  document: OpenApiDocument;
  path?: string;
  operationIdPrefix?: string;
  /** Append tags to path and webhook operations in this document. */
  tags?: readonly string[];
}
function combine(target: object, incoming: object, context: string): void {
  const record = target as Record<string, unknown>;
  for (const [name, value] of Object.entries(incoming)) {
    if (Object.hasOwn(record, name) && stableJson(record[name]) !== stableJson(value))
      throw new GenerationError(`Conflicting ${context} ${name} while merging documents.`);
    Object.defineProperty(record, name, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
}

/** Method maps merge by token; other Path Item fields retain their collision rules. */
export function mergePathItem(target: PathItem, incoming: PathItem, context: string): void {
  if (target.additionalOperations && incoming.additionalOperations) {
    combine(
      target.additionalOperations,
      incoming.additionalOperations,
      `${context} additional operation`,
    );
    const fields = { ...incoming };
    delete fields.additionalOperations;
    combine(target, fields, context);
  } else combine(target, incoming, context);
}

function pathDefaults(
  child: OpenApiDocument,
  result: OpenApiDocument,
  external: boolean,
  hasServers: boolean,
): void {
  if (
    external &&
    (stableJson(child.security ?? []) !== stableJson(result.security ?? []) ||
      (!hasServers &&
        stableJson(child.servers?.length ? child.servers : [{ url: '/' }]) !==
          stableJson(result.servers?.length ? result.servers : [{ url: '/' }])))
  )
    throw new GenerationError(
      'Cannot preserve differing defaults for an externally referenced Path Item without resolving its operations.',
    );
}

/** Composes independently generated documents, preserving inputs and rejecting ambiguous collisions. */
export function mergeDocuments(
  base: OpenApiDocument,
  parts: readonly DocumentPart[],
): OpenApiDocument {
  if (!Array.isArray(parts) || parts.length > 1000)
    throw new GenerationError('Document parts must be an array of at most 1000 entries.');
  const result = structuredClone(base);
  new DocumentValidation().validate(result);
  for (const part of parts) {
    const child: OpenApiDocument = structuredClone(part.document);
    new DocumentValidation().validate(child);
    if (child.openapi !== result.openapi)
      throw new GenerationError('Composed documents must use the same OpenAPI version.');
    const rebase = child.$self !== result.$self;
    if (
      rebase &&
      (!child.$self ||
        !result.$self ||
        !uriResolver.parse(child.$self).scheme ||
        !uriResolver.parse(result.$self).scheme)
    )
      throw new GenerationError(
        'Composing differing document identities requires absolute $self URIs on both documents.',
      );
    if (part.path !== undefined && typeof part.path !== 'string')
      throw new GenerationError('Merged document path must be a string.');
    const prefix = (part.path ?? '').replace(/\/$/, '');
    if (prefix && !prefix.startsWith('/'))
      throw new GenerationError('Merged document path must start with /.');
    const tags = tagNames(part.tags);
    const references = new DocumentReferences(child);
    for (const [, raw] of [
      ...Object.entries(child.paths).filter(([path]) => !path.startsWith('x-')),
      ...Object.entries(child.webhooks ?? {}),
    ]) {
      const item = raw as unknown as Record<string, unknown>;
      let hasServers = item.servers !== undefined;
      const target =
        typeof item.$ref === 'string'
          ? references.resolve(item.$ref, (alias) => {
              if (Object.hasOwn(alias, 'servers')) hasServers = true;
            })
          : item;
      pathDefaults(child, result, target === undefined, hasServers);
      if (!tags.length) continue;
      if (target === undefined)
        throw new GenerationError(
          'Cannot append tags to an externally referenced Path Item without resolving its operations.',
        );
      for (const operation of [item, target].flatMap((value) =>
        operationsOf(value as Record<string, unknown>),
      )) {
        const value = operation as { tags?: string[] };
        value.tags = [...new Set([...(value.tags ?? []), ...tags])];
      }
    }
    const ids = part.operationIdPrefix ?? '';
    if (typeof ids !== 'string') throw new GenerationError('operationIdPrefix must be a string.');
    const relocate = (ref: string): string => {
      if (!prefix && !rebase) return ref;
      const parts = documentPointer(ref, child.$self);
      if (parts === undefined) return rebase ? uriResolver.resolve(child.$self!, ref) : ref;
      if (parts[0] === 'paths' && parts.length >= 2) parts[1] = prefix + parts[1];
      else if (!rebase) return ref;
      return parts.length ? '#/' + parts.map(pointer).join('/') : '#';
    };
    // Resolve the original reference graph before moving its path pointers.
    const relocated = new Map<Record<string, unknown>, string>();
    const schemas: { owner: Record<string, unknown>; key: string; schema: Schema }[] = [];
    visitResolvedDocument(child, references, {
      schema: (value, owner, key) => {
        if ((!prefix && !rebase) || typeof value === 'boolean') return;
        const schema = absoluteSchema(value as Schema, child.$self ?? '', child.components.schemas);
        schemas.push({
          owner,
          key,
          schema: mapSchema(schema, (node) =>
            mapReferences(node, (ref, kind) => {
              if (kind === 'mapping' && Object.hasOwn(child.components.schemas, ref)) return ref;
              const fragment = uriResolver.parse(ref).fragment;
              if (fragment !== undefined && !decodeURIComponent(fragment).startsWith('/'))
                return ref;
              const moved = relocate(ref);
              return moved !== ref && moved.startsWith('#') && result.$self !== undefined
                ? result.$self!.split('#')[0] + moved
                : moved;
            }),
          ),
        });
      },
      object: (object, role, parent) => {
        if (typeof object.$ref === 'string') {
          relocated.set(object, relocate(object.$ref));
        }
        if (rebase && role === 'externalDocs' && typeof object.url === 'string')
          object.url = uriResolver.resolve(child.$self!, object.url);
        if (rebase && role === 'exampleObject' && typeof object.externalValue === 'string')
          object.externalValue = uriResolver.resolve(child.$self!, object.externalValue);
        if (role === 'linkObject') {
          if (typeof object.operationId === 'string') object.operationId = ids + object.operationId;
          if (typeof object.operationRef === 'string')
            object.operationRef = relocate(object.operationRef);
        }
        if (role === 'operationObject' && typeof object.operationId === 'string') {
          object.operationId = ids + object.operationId;
          if (
            object.security === undefined &&
            stableJson(child.security ?? []) !== stableJson(result.security ?? [])
          )
            object.security = child.security ?? [];
          if (rebase && Array.isArray(object.security))
            object.security = object.security.map((requirement: Record<string, unknown>) =>
              Object.fromEntries(
                Object.entries(requirement).map(([name, scopes]) => [
                  Object.hasOwn(child.components.securitySchemes ?? {}, name)
                    ? name
                    : relocate(name),
                  scopes,
                ]),
              ),
            );
          if (
            object.servers === undefined &&
            parent?.servers === undefined &&
            stableJson(child.servers?.length ? child.servers : [{ url: '/' }]) !==
              stableJson(result.servers?.length ? result.servers : [{ url: '/' }])
          )
            object.servers = child.servers?.length ? child.servers : [{ url: '/' }];
        }
      },
    });
    for (const [object, ref] of relocated) object.$ref = ref;
    for (const { owner, key, schema } of schemas) owner[key] = schema;
    for (const [path, item] of Object.entries(child.paths)) {
      if (path.startsWith('x-')) {
        combine(result.paths as Record<string, unknown>, { [path]: item }, 'path extension');
        continue;
      }
      const destination = prefix + path;
      if (!Object.hasOwn(result.paths, destination)) result.paths[destination] = item;
      else mergePathItem(result.paths[destination]!, item, `path ${destination}`);
    }
    const components = result.components as Record<string, unknown>;
    for (const [section, entries] of Object.entries(child.components)) {
      if (section.startsWith('x-')) {
        combine(components, { [section]: entries }, 'component extension');
        continue;
      }
      components[section] ??= {};
      combine(
        components[section] as Record<string, unknown>,
        entries as Record<string, unknown>,
        `${section} component`,
      );
    }
    combine(
      result,
      Object.fromEntries(Object.entries(child).filter(([key]) => key.startsWith('x-'))),
      'document extension',
    );
    if (child.tags) {
      const tags = new Map((result.tags ?? []).map((tag) => [tag.name, tag]));
      for (const tag of child.tags) {
        if (tags.has(tag.name) && stableJson(tags.get(tag.name)) !== stableJson(tag))
          throw new GenerationError(`Conflicting tag ${tag.name} while merging documents.`);
        tags.set(tag.name, tag);
      }
      result.tags = [...tags.values()];
    }
    if (child.webhooks) {
      result.webhooks ??= Object.create(null) as NonNullable<OpenApiDocument['webhooks']>;
      for (const [name, item] of Object.entries(child.webhooks)) {
        if (Object.hasOwn(result.webhooks, name))
          mergePathItem(result.webhooks[name]!, item, `webhook ${name}`);
        else
          Object.defineProperty(result.webhooks, name, {
            value: item,
            writable: true,
            enumerable: true,
            configurable: true,
          });
      }
    }
  }
  new DocumentValidation().validate(result);
  return result;
}
