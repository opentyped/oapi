import { parsePointer } from '~/pointer';
import uriResolver from 'fast-uri';
import type { Schema, Components } from '~/schema/definition';
import { GenerationError } from '~/diagnostic';
import { visitSchema, mapSchema } from '~/schema/visitor';
import { componentPath, mapReferences } from '~/schema/reference';

const { normalize, parse, resolve, serialize } = uriResolver;

interface Resource {
  id?: string;
  path: readonly string[];
  anchors: Map<string, string>;
}
interface Reference {
  text: string;
  resource: Resource;
  path: readonly string[];
  kind: '$ref' | '$dynamicRef' | 'mapping';
}
export interface SchemaDependency {
  source: readonly string[];
  target: readonly string[];
  text: string;
  kind: '$ref' | '$dynamicRef' | 'mapping';
  resource: readonly string[];
  uri?: string;
}
export interface SchemaCatalog {
  dependencies: readonly SchemaDependency[];
  dynamicAnchors: readonly { resource: readonly string[]; target: readonly string[] }[];
  /** Resolve an edge from an existing schema position, or from the document root. */
  resolve(reference: string, source?: readonly string[]): readonly string[] | undefined;
  targets(schema: Schema): readonly (readonly string[])[];
}
export type SchemaMode = 'embedded' | 'standalone' | 'document';
export interface SchemaEntry {
  schema: Schema | boolean;
  path: readonly string[];
}
function uri(value: string): void {
  if (
    /\s|%(?![0-9a-fA-F]{2})/.test(value) ||
    [...value].some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    parse(value).error
  )
    throw new GenerationError(`Invalid schema reference URI ${value}.`);
}
function location(path: readonly string[]): string {
  return JSON.stringify(path);
}
const inPlace = new Set([
  'allOf',
  'anyOf',
  'oneOf',
  'not',
  'if',
  'then',
  'else',
  'dependentSchemas',
]);

/** Indexes resource scopes before resolving static reference targets. Never fetches URIs. */
export class SchemaResource {
  constructor(
    private readonly root: Schema | readonly SchemaEntry[],
    private readonly mode: SchemaMode = 'embedded',
    private readonly baseUri?: string,
    /** Document regions supplied by a later composition stage; final validation must omit these. */
    private readonly pending: readonly (readonly string[])[] = [],
  ) {}

  validate(): SchemaCatalog {
    const root: Resource = { path: [], anchors: new Map() };
    const resources = new Map<string, Resource>();
    if (this.mode === 'document' && this.baseUri !== undefined) {
      uri(this.baseUri);
      const parts = parse(this.baseUri);
      delete parts.fragment;
      root.id = normalize(serialize(parts));
      resources.set(root.id, root);
    }
    const positions = new Set<string>();
    const owners = new Map<string, Resource>();
    const refs: Reference[] = [];
    const dynamicAnchors: { resource: readonly string[]; target: readonly string[] }[] = [];
    const edges = new Map<string, Set<string>>();
    const terminal = new Set<string>();
    const connect = (source: string, target: string): void => {
      const targets = edges.get(source) ?? new Set<string>();
      targets.add(target);
      edges.set(source, targets);
    };
    const entries: readonly SchemaEntry[] = Array.isArray(this.root)
      ? this.root
      : [{ schema: this.root as Schema, path: [] }];
    for (const entry of entries) {
      const scopes = new Map<string, Resource>();
      visitSchema(entry.schema, (node, relative) => {
        const path = [...entry.path, ...relative];
        for (let length = relative.length - 1; length >= 0; length--) {
          const parent = relative.slice(0, length);
          if (!scopes.has(location(parent))) continue;
          if (inPlace.has(relative[length]!))
            connect(location([...entry.path, ...parent]), location(path));
          break;
        }
        const parent = relative.length ? scopes.get(location(relative.slice(0, -1))) : root;
        // Keyword containers (properties, $defs, lists) inherit the nearest schema's scope.
        let resource = parent;
        for (let length = relative.length - 1; !resource && length >= 0; length--)
          resource = scopes.get(location(relative.slice(0, length)));
        resource ??= root;
        if (typeof node !== 'boolean' && node.$id !== undefined) {
          if (typeof node.$id !== 'string')
            throw new GenerationError(
              'Schema $id must be an absolute URI or resolve against an owning resource.',
            );
          uri(node.$id);
          const identity = resource.id ? resolve(resource.id, node.$id) : node.$id;
          uri(identity);
          const parts = parse(identity);
          if (!parts.scheme || (parts.fragment !== undefined && parts.fragment !== ''))
            throw new GenerationError(
              'Schema $id must be an absolute URI without a nonempty fragment.',
            );
          delete parts.fragment;
          const id = normalize(serialize(parts));
          if (resources.has(id)) throw new GenerationError(`Duplicate schema resource $id ${id}.`);
          resource = { id, path, anchors: new Map() };
          resources.set(id, resource);
        }
        scopes.set(location(relative), resource);
        positions.add(location(path));
        owners.set(location(path), resource);
        const negation: unknown = typeof node === 'boolean' ? undefined : node.not;
        if (
          node === false ||
          negation === true ||
          (negation && typeof negation === 'object' && !Object.keys(negation).length)
        )
          terminal.add(location(path));
        if (typeof node === 'boolean') return;
        for (const field of ['$anchor', '$dynamicAnchor'] as const) {
          const anchor = node[field];
          if (typeof anchor === 'string') {
            if (resource.anchors.has(anchor) && resource.anchors.get(anchor) !== location(path))
              throw new GenerationError(`Duplicate schema anchor ${anchor}.`);
            resource.anchors.set(anchor, location(path));
            if (field === '$dynamicAnchor')
              dynamicAnchors.push({ resource: resource.path, target: path });
          }
        }
        mapReferences(node, (text, kind) => {
          refs.push({ text, resource, path, kind });
          return text;
        });
      });
    }
    const dependencies: SchemaDependency[] = [];
    for (const reference of refs) {
      const target = this.reference(reference, resources, positions);
      if (target) {
        if (reference.kind !== 'mapping') connect(location(reference.path), location(target));
        const resource = owners.get(location(target));
        dependencies.push({
          source: reference.path,
          target,
          text: reference.text,
          kind: reference.kind,
          resource: resource?.path ?? [],
          ...(resource?.id !== undefined ? { uri: resource.id } : {}),
        });
      }
    }
    this.checkCycles(edges, terminal);
    return {
      dependencies,
      dynamicAnchors,
      resolve: (text, source = []): readonly string[] | undefined => {
        const owner = owners.get(location(source));
        if (source.length && !owner)
          throw new GenerationError('Reference source must be an existing schema position.');
        return this.reference(
          { text, resource: owner ?? root, path: source, kind: '$ref' },
          resources,
          positions,
        );
      },
      targets: (schema): readonly (readonly string[])[] => {
        const scopes = new Map<string, Resource>();
        const targets: (readonly string[])[] = [];
        visitSchema(schema, (node, path) => {
          let resource = root;
          for (let length = path.length - 1; length >= 0; length--) {
            const parent = scopes.get(location(path.slice(0, length)));
            if (parent) {
              resource = parent;
              break;
            }
          }
          if (typeof node !== 'boolean' && node.$id !== undefined) {
            const parts = parse(resource.id ? resolve(resource.id, node.$id) : node.$id);
            delete parts.fragment;
            const id = normalize(serialize(parts));
            resource = resources.get(id) ?? { id, path: ['x-opentyped-query'], anchors: new Map() };
          }
          scopes.set(location(path), resource);
          if (typeof node === 'boolean') return;
          mapReferences(node, (text, kind) => {
            if (!resource.id && (text === '' || text.startsWith('#')) && !componentPath(text))
              return text;
            const target = this.reference({ text, resource, path, kind }, resources, positions);
            if (target) targets.push(target);
            return text;
          });
        });
        return targets;
      },
    };
  }

  /** Iterative traversal also handles long alias chains without consuming the JS call stack. */
  private checkCycles(edges: Map<string, Set<string>>, terminal: Set<string>): void {
    const states = new Map<string, number>();
    const targets = (node: string): SetIterator<string> =>
      (terminal.has(node) ? new Set<string>() : (edges.get(node) ?? new Set<string>())).values();
    for (const node of edges.keys()) {
      if (states.has(node)) continue;
      states.set(node, 1);
      const stack = [{ node, targets: targets(node) }];
      while (stack.length) {
        const frame = stack.at(-1)!;
        const next = frame.targets.next();
        if (next.done) {
          states.set(frame.node, 2);
          stack.pop();
          continue;
        }
        if (states.get(next.value) === 1) {
          const start = stack.findIndex((entry) => entry.node === next.value);
          const cycle = [...stack.slice(start).map((entry) => entry.node), next.value];
          throw new GenerationError(
            `Unproductive schema reference cycle (no data boundary): ${cycle.slice(0, 8).join(' -> ')}${cycle.length > 8 ? ' -> ...' : ''}`,
          );
        }
        if (!states.has(next.value)) {
          states.set(next.value, 1);
          stack.push({ node: next.value, targets: targets(next.value) });
        }
      }
    }
  }

  private reference(
    { text, resource, kind }: Reference,
    resources: Map<string, Resource>,
    positions: Set<string>,
  ): readonly string[] | undefined {
    if (kind === 'mapping' && positions.has(location(['components', 'schemas', text])))
      return ['components', 'schemas', text];
    uri(text);
    const component = this.mode === 'embedded' ? componentPath(text) : undefined;
    if (component) {
      if (resource.id)
        throw new GenerationError(
          'A schema with $id cannot use document-relative component references. Use an absolute document URI.',
        );
      return ['components', 'schemas', ...component];
    }
    const local =
      (!resource.id || (this.mode === 'document' && resource.path.length === 0)) &&
      (text === '' || text.startsWith('#'));
    if (local && this.mode === 'embedded')
      throw new GenerationError(
        'Schema-local references require an absolute $id when embedded in OpenAPI.',
      );
    if (
      resource.id &&
      !parse(resource.id).scheme &&
      !parse(resource.id).path?.startsWith('/') &&
      text !== '' &&
      !text.startsWith('#') &&
      !parse(text).scheme
    )
      throw new GenerationError(
        'Non-fragment schema references with a relative document URI require an absolute URI.',
      );
    const absolute = resource.id ? resolve(resource.id, text) : text;
    uri(absolute);
    const parts = parse(absolute);
    const fragment = parts.fragment ?? '';
    delete parts.fragment;
    const target = local ? resource : resources.get(normalize(serialize(parts)));
    if (!target) return;
    let decoded: string;
    try {
      decoded = decodeURIComponent(fragment);
    } catch {
      throw new GenerationError(`Invalid schema reference encoding ${text}.`);
    }
    if (!decoded) {
      if (!positions.has(location(target.path)))
        throw new GenerationError(
          `Unresolved schema reference ${text}; target must be a schema position.`,
        );
      return target.path;
    }
    if (!decoded.startsWith('/')) {
      if (!target.anchors.has(decoded))
        throw new GenerationError(`Unresolved schema anchor ${text}.`);
      return JSON.parse(target.anchors.get(decoded)!) as string[];
    }
    let path: string[];
    try {
      path = parsePointer(decoded);
    } catch {
      throw new GenerationError(`Invalid JSON pointer ${text}.`);
    }
    if (!positions.has(location([...target.path, ...path]))) {
      if (
        this.mode === 'document' &&
        target.path.length === 0 &&
        this.pending.some(
          (prefix) => prefix.length > 0 && prefix.every((token, index) => path[index] === token),
        )
      )
        return;
      throw new GenerationError(
        `Unresolved schema-local reference ${text}; target must be a schema position.`,
      );
    }
    return [...target.path, ...path];
  }
}

/** Preserve lexical resource scopes when moving document schemas into standalone artifacts. */
export function absoluteSchema(
  schema: Schema,
  baseUri: string,
  components: Components = {},
): Schema {
  uri(baseUri);
  const result = mapSchema(schema, (node) => node);
  const scopes = new Map<string, string>();
  visitSchema(result, (node, path) => {
    let base = baseUri;
    for (let length = path.length - 1; length >= 0; length--) {
      const parent = scopes.get(location(path.slice(0, length)));
      if (parent !== undefined) {
        base = parent;
        break;
      }
    }
    if (typeof node === 'boolean') return;
    if (node.$id !== undefined) {
      uri(node.$id);
      node.$id = normalize(resolve(base, node.$id));
      base = node.$id;
    }
    scopes.set(location(path), base);
    Object.assign(
      node,
      mapReferences(node, (ref, kind) => {
        if (kind === 'mapping' && Object.hasOwn(components, ref)) return ref;
        if (ref === '' || ref.startsWith('#')) return ref;
        uri(ref);
        return normalize(resolve(base, ref));
      }),
    );
  });
  return result;
}
