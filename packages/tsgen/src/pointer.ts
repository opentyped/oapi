import {
  escapePointer as escapeToken,
  parsePointer,
  walkPointer,
  formatPointer,
} from '@opentyped/openapi/pointer';
import { visitDocument } from '@opentyped/openapi/document/visitor';
import { SchemaResource } from '@opentyped/openapi/schema/resource';
import type { SchemaEntry } from '@opentyped/openapi/schema/resource';
import type { Schema } from '@opentyped/openapi/schema/definition';
import { visitSchema } from '@opentyped/openapi/schema/visitor';

/** RFC 6901 token escaping and URI fragment encoding. */
export function escapePointer(value: string | number): string {
  return encodeURIComponent(escapeToken(value));
}

export function parseRef(value: string): { pointer: string[] } {
  const hash = value.indexOf('#');
  if (value !== '' && hash !== 0)
    throw new Error(`Bundle external references before definition generation: ${value}`);
  if (hash < 0) return { pointer: [] };
  const fragment = decodeURIComponent(value.slice(hash + 1));
  if (!fragment) return { pointer: [] };
  if (!fragment.startsWith('/'))
    throw new Error(`Schema anchors must be resolved before definition generation: ${value}`);
  return { pointer: parsePointer('#' + value.slice(hash + 1)) };
}

export function localReference(value: string, documentUri?: string): string {
  return documentUri && value.startsWith(`${documentUri}#`)
    ? value.slice(documentUri.length)
    : value;
}

/** Build a `#/`-reference from path segments; a leading reference is spliced in. */
export function createRef(parts: readonly (string | number | undefined | null)[]): string {
  let pointer = '#';
  for (const [index, part] of parts.entries()) {
    if (part === undefined || part === null || part === '') continue;
    const nested =
      index === 0 && String(part).startsWith('#/') ? parseRef(String(part)).pointer : [];
    if (nested.length) {
      for (const segment of nested) pointer += `/${escapePointer(segment)}`;
    } else {
      pointer += `/${escapePointer(part)}`;
    }
  }
  return pointer;
}

/** Resolve embedded resource scopes before upstream turns references into indexed types. */
export function resolveSchemaReferences(
  document: object,
  documentUri?: string,
): Map<string, Schema | boolean> {
  const entries: SchemaEntry[] = [];
  visitDocument(document, {
    schema(value, _owner, _key, path) {
      entries.push({ schema: value as Schema | boolean, path });
    },
  });
  const catalog = new SchemaResource(entries, 'document', documentUri).validate();
  const owners = new Map<string, string>();
  const anchors = new Map<string, { resource: string; path: string }[]>();
  const edges = new Map<string, Set<string>>();
  const connect = (source: string, target: string): void => {
    const targets = edges.get(source) ?? new Set<string>();
    targets.add(target);
    edges.set(source, targets);
  };
  for (const entry of entries)
    visitSchema(entry.schema, (node, relative) => {
      const absolute = [...entry.path, ...relative];
      const path = JSON.stringify(absolute);
      let parent = '[]';
      for (let length = absolute.length - 1; length >= 0; length--) {
        const inherited = owners.get(JSON.stringify(absolute.slice(0, length)));
        if (inherited === undefined) continue;
        parent = inherited;
        break;
      }
      const resource = typeof node !== 'boolean' && typeof node.$id === 'string' ? path : parent;
      // Lexical containment over-approximates evaluation, including dormant $defs.
      if (resource !== parent) connect(parent, resource);
      owners.set(path, resource);
      if (typeof node !== 'boolean' && typeof node.$dynamicAnchor === 'string') {
        const values = anchors.get(node.$dynamicAnchor) ?? [];
        values.push({ resource, path });
        anchors.set(node.$dynamicAnchor, values);
      }
    });
  for (const dependency of catalog.dependencies) {
    if (dependency.kind === 'mapping') continue;
    const source = owners.get(JSON.stringify(dependency.source))!;
    const target = owners.get(JSON.stringify(dependency.target))!;
    connect(source, target);
  }
  const reachable = new Map<string, Set<string>>();
  const reaches = (entry: string): Set<string> => {
    const cached = reachable.get(entry);
    if (cached) return cached;
    const visited = new Set<string>();
    const pending = [entry];
    while (pending.length) {
      const next = pending.pop()!;
      if (visited.has(next)) continue;
      visited.add(next);
      pending.push(...(edges.get(next) ?? []));
    }
    reachable.set(entry, visited);
    return visited;
  };
  for (const dependency of catalog.dependencies) {
    if (dependency.kind === 'mapping') continue;
    const source = walkPointer(document, dependency.source);
    if (!source.found) throw new Error('Missing indexed schema source.');
    const node = source.value as Record<string, unknown>;
    const reference = formatPointer(dependency.target, true);
    if (dependency.kind === '$ref') node.$ref = reference;
    else {
      const resolved = walkPointer(document, dependency.target);
      if (!resolved.found) throw new Error('Missing indexed schema target.');
      const target = resolved.value as Record<string, unknown>;
      const anchor = target && target.$dynamicAnchor;
      const fragment = decodeURIComponent(dependency.text.split('#')[1] ?? '');
      if (
        fragment &&
        !fragment.startsWith('/') &&
        typeof anchor === 'string' &&
        anchors
          .get(anchor)
          ?.some(
            (candidate) =>
              candidate.path !== JSON.stringify(dependency.target) &&
              reaches(candidate.resource).has(owners.get(JSON.stringify(dependency.source))!),
          )
      )
        throw new Error(
          `Dynamic schema anchor ${anchor} requires scope specialization at ${dependency.source.join('/')}.`,
        );
      delete node.$dynamicRef;
      const allOf = Array.isArray(node.allOf) ? node.allOf : [];
      node.allOf = [
        ...allOf,
        ...(typeof node.$ref === 'string' ? [{ $ref: node.$ref }] : []),
        { $ref: reference },
      ];
      delete node.$ref;
    }
  }
  const definitions = new Map<string, Schema | boolean>();
  for (const entry of entries)
    visitSchema(entry.schema, (node, relative) => {
      if (relative.at(-2) === '$defs')
        definitions.set(formatPointer([...entry.path, ...relative], true), node);
    });
  for (const dependency of catalog.dependencies) {
    if (
      dependency.kind === 'mapping' ||
      (dependency.target.length === 3 &&
        dependency.target[0] === 'components' &&
        dependency.target[1] === 'schemas')
    )
      continue;
    const resolved = walkPointer(document, dependency.target);
    if (!resolved.found) throw new Error('Missing indexed schema target.');
    const target = resolved.value;
    definitions.set(formatPointer(dependency.target, true), target as Schema | boolean);
  }
  for (const entry of entries)
    visitSchema(entry.schema, (node, relative) => {
      if (typeof node !== 'boolean' && node.$dynamicRef !== undefined)
        throw new Error(
          `Bundle external dynamic reference ${node.$dynamicRef} before definition generation at ${[...entry.path, ...relative].join('/')}.`,
        );
    });
  return definitions;
}
