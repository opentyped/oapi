import { createHash } from 'node:crypto';
import { stableJson } from '~/json';
import type { SchemaEntry, SchemaCatalog, SchemaDependency } from '~/schema/resource';
import { absoluteSchema } from '~/schema/resource';
import uriResolver from 'fast-uri';
import { SchemaResource } from '~/schema/resource';
import { publicSchema } from '~/schema/public';
import type { Schema, Components } from '~/schema/definition';
import { GenerationError } from '~/diagnostic';
import { mapSchema, visitSchema } from '~/schema/visitor';
import { componentPath, pointer, mapReferences } from '~/schema/reference';
import { DIALECT } from '~/schema/dialect';

export const SCHEMA_ANNOTATIONS: ReadonlySet<string> = new Set([
  'title',
  'description',
  'default',
  'example',
  'examples',
  'deprecated',
  'readOnly',
  'writeOnly',
  'xml',
  'contentEncoding',
  'contentMediaType',
  'contentSchema',
  '$comment',
  'http',
  'inline',
]);

/** Select schema positions without mistaking examples or keyword containers for schemas. */
function componentSchema(ref: string, components: Components): Schema {
  const tokens = componentPath(ref);
  if (!tokens) throw new GenerationError(`Unexpected reference ${ref}`);
  const [name, ...path] = tokens;
  if (!Object.hasOwn(components, name!))
    throw new GenerationError(`Unresolved schema reference ${ref}`);
  const root = components[name!]!;
  if (!path.length) return root;
  let selected: Schema | boolean | undefined;
  let scoped = false;
  visitSchema(root, (node, position) => {
    if (!position.every((token, index) => token === path[index])) return;
    if (position.length === path.length) selected = node;
    else if (typeof node !== 'boolean' && node.$id !== undefined) scoped = true;
  });
  if (selected === undefined)
    throw new GenerationError(`Reference must target a schema position: ${ref}`);
  if (scoped)
    throw new GenerationError(
      `Cannot expand ${ref} outside its owning schema resource; retain the reference instead.`,
    );
  return typeof selected === 'boolean' ? (selected ? {} : { not: {} }) : selected;
}

export function dereference(schema: Schema, components: Record<string, Schema>): Schema {
  const seen = new Set<string>();
  let current = schema;
  while (current.$ref) {
    if (seen.has(current.$ref))
      throw new GenerationError(
        `Circular schema alias cannot describe an HTTP envelope: ${current.$ref}`,
      );
    seen.add(current.$ref);
    const target = componentSchema(current.$ref, components);
    const siblings = { ...current };
    delete siblings.$ref;
    current = { ...target, ...siblings };
    if (target.required && siblings.required)
      current.required = [...new Set([...target.required, ...siblings.required])];
  }
  return current;
}

/** Embed selected reference/container types while retaining references within object fields. */
export function inlineSchema(root: Schema, components: Components): Schema {
  return inlineReferences(root, (ref) => {
    if (!componentPath(ref))
      throw new GenerationError(`Cannot inline external or resource-local reference ${ref}.`);
    return componentSchema(ref, components);
  });
}

/** Expand a selected edge using its owning document's reference resolver. */
export function inlineReferences(root: Schema, resolve: (ref: string) => Schema): Schema {
  let nodes = 0;
  const expand = (schema: Schema, active: Set<string>, depth: number): Schema => {
    if (++nodes > 10000 || depth > 100)
      throw new GenerationError('Inline schema expansion exceeds the traversal budget.');
    if (typeof schema === 'boolean') return schema ? {} : { not: {} };
    if (schema.$id !== undefined) return { ...schema };
    if (schema.$ref) {
      const ref = schema.$ref;
      if (active.has(ref)) return { ...schema };
      const target = expand(resolve(ref), new Set(active).add(ref), depth + 1);
      const siblings = { ...schema };
      delete siblings.$ref;
      const metadata = Object.fromEntries(
        [...Object.entries(target), ...Object.entries(siblings)].filter(
          ([key]) => SCHEMA_ANNOTATIONS.has(key) || key.startsWith('x-'),
        ),
      );
      const assertions = Object.fromEntries(
        Object.entries(siblings).filter(
          ([key]) => !SCHEMA_ANNOTATIONS.has(key) && !key.startsWith('x-'),
        ),
      );
      const base = Object.fromEntries(
        Object.entries(target).filter(
          ([key]) =>
            !Object.hasOwn(siblings, key) ||
            (!SCHEMA_ANNOTATIONS.has(key) && !key.startsWith('x-')),
        ),
      );
      return Object.keys(assertions).length
        ? { ...metadata, allOf: [base, assertions] }
        : { ...target, ...metadata };
    }
    const result = { ...schema };
    if (result.discriminator !== undefined) return result;
    for (const key of ['anyOf', 'oneOf', 'allOf', 'prefixItems'] as const)
      if (result[key]) result[key] = result[key]!.map((part) => expand(part, active, depth + 1));
    for (const key of ['items', 'additionalProperties'] as const) {
      const value = result[key];
      if (value && typeof value === 'object') result[key] = expand(value, active, depth + 1);
    }
    return result;
  };
  return expand(root, new Set(), 0);
}

/** Construct a tagged union after each backend resolves its required literal tag. */
export function discriminatedUnion<T extends { $ref?: string | undefined }>(
  name: string,
  variants: readonly { schema: T; values: readonly unknown[] }[],
): {
  type: 'object';
  required: string[];
  oneOf: T[];
  discriminator: { propertyName: string; mapping: Record<string, string> };
} {
  const mapping = Object.create(null) as Record<string, string>;
  const oneOf: T[] = [];
  for (const { schema, values } of variants) {
    if (!schema.$ref)
      throw new GenerationError(
        'Discriminator variants must be named object types with literal tags.',
      );
    if (!values.length) throw new GenerationError('Discriminator tags must be string literals.');
    for (const value of values) {
      if (typeof value !== 'string')
        throw new GenerationError('Discriminator tags must be string literals.');
      if (Object.hasOwn(mapping, value))
        throw new GenerationError(`Duplicate discriminator value ${value}.`);
      mapping[value] = schema.$ref;
    }
    oneOf.push(schema);
  }
  return {
    type: 'object',
    required: [name],
    oneOf,
    discriminator: { propertyName: name, mapping },
  };
}

/** Include precisely the reachable graph in each standalone artifact. Cycles stay as references. */
export function standalone(root: Schema, components: Record<string, Schema>): Schema {
  const localDefinitions = (root.$defs ?? {}) as Record<string, Schema>;
  const definitions: Record<string, Schema> = Object.assign(
    Object.create(null) as Record<string, Schema>,
    localDefinitions,
  );
  const reserved = new Set(Object.keys(localDefinitions));
  const names = new Map<string, string>();
  for (const name of Object.keys(components)) {
    let target = name;
    while (reserved.has(target)) target = 'component_' + target;
    reserved.add(target);
    names.set(name, target);
  }
  const include = (key: string): string => {
    const target = components[key];
    if (
      root.$id !== undefined &&
      target?.$id !== undefined &&
      uriResolver.normalize(root.$id.replace(/#$/, '')) ===
        uriResolver.normalize(target.$id.replace(/#$/, ''))
    )
      return '#';
    if (!Object.hasOwn(components, key))
      throw new GenerationError(`Unresolved schema component ${key}`);
    const name = names.get(key)!;
    if (!Object.hasOwn(definitions, name)) {
      definitions[name] = {};
      definitions[name] = publicSchema(rewrite(components[key]!));
    }
    return '#/$defs/' + pointer(name);
  };
  const rewrite = (schema: Schema): Schema =>
    mapSchema(schema, (item) => {
      return mapReferences(item, (ref) => {
        const tokens = componentPath(ref);
        if (!tokens) return ref;
        const [key, ...path] = tokens;
        return include(key!) + (path.length ? '/' + path.map(pointer).join('/') : '');
      });
    });
  const schema = publicSchema(rewrite(root));
  Object.keys(reachableComponents([root], components)).forEach(include);
  for (const name of Object.keys(localDefinitions))
    definitions[name] = publicSchema(rewrite(localDefinitions[name]!));
  return {
    $schema: DIALECT,
    ...schema,
    ...(Object.keys(definitions).length ? { $defs: definitions } : {}),
  };
}

/** Reachability is a property of schema positions, not arbitrary JSON object keys. */
export function reachableComponents(roots: Schema[], components: Components): Components {
  const entries = Object.entries(components).map(([name, schema]) => ({
    schema,
    path: ['components', 'schemas', name],
  }));
  return Object.fromEntries(
    new SchemaGraph(entries)
      .reachable(roots)
      .filter(({ path }) => path[0] === 'components' && path[1] === 'schemas')
      .map(({ path }) => [path[2]!, publicSchema(components[path[2]!]!)]),
  );
}

/** The document's schema positions form one graph, including schemas outside components. */
export class SchemaGraph {
  private readonly entries: SchemaEntry[];
  private readonly catalog: SchemaCatalog;
  private readonly positions = new Map<string, SchemaEntry>();
  private readonly references = new Map<string, SchemaDependency[]>();
  private readonly dependencies = new Map<SchemaEntry, Set<SchemaEntry>>();

  constructor(
    entries: readonly SchemaEntry[],
    private readonly self?: string,
  ) {
    const components: Components = Object.fromEntries(
      entries
        .filter(({ path }) => path[0] === 'components' && path[1] === 'schemas')
        .map(({ path, schema }) => [path[2]!, typeof schema === 'boolean' ? {} : schema]),
    );
    this.entries = [
      ...new Map(entries.map((entry) => [stableJson(entry.path), entry])).values(),
    ].map(({ schema, path }) => ({
      schema:
        typeof schema === 'boolean'
          ? schema
          : absoluteSchema(publicSchema(schema), self ?? '', components),
      path,
    }));
    for (const entry of this.entries) this.positions.set(stableJson(entry.path), entry);
    this.catalog = new SchemaResource(this.entries, 'document', self).validate();
    for (const edge of this.catalog.dependencies) {
      const source = this.owner(edge.source);
      const targets = this.dependencies.get(source) ?? new Set<SchemaEntry>();
      targets.add(this.owner(edge.target));
      this.dependencies.set(source, targets);
      const refs = this.references.get(stableJson(edge.source)) ?? [];
      refs.push(edge);
      this.references.set(stableJson(edge.source), refs);
    }
    // An active resource's dynamic anchors can override references without a static edge.
    const dynamic = this.catalog.dynamicAnchors
      .filter(({ resource }) => resource.length === 0)
      .map(({ target }) => this.owner(target));
    for (const entry of this.entries) {
      if (typeof entry.schema !== 'boolean' && entry.schema.$id !== undefined) continue;
      const targets = this.dependencies.get(entry) ?? new Set<SchemaEntry>();
      for (const target of dynamic) targets.add(target);
      this.dependencies.set(entry, targets);
    }
  }

  reachable(roots: readonly Schema[]): readonly SchemaEntry[] {
    const seeds = roots.flatMap((root) =>
      this.catalog.targets(root).map((path) => this.owner(path)),
    );
    if (roots.some((root) => root.$id === undefined))
      seeds.push(
        ...this.catalog.dynamicAnchors
          .filter(({ resource }) => resource.length === 0)
          .map(({ target }) => this.owner(target)),
      );
    return this.closure(seeds);
  }

  bundle(root: Schema): Schema {
    const normalized = absoluteSchema(root, this.self ?? '');
    const entry =
      normalized.$id === undefined
        ? undefined
        : this.entries.find(
            ({ schema }) => typeof schema !== 'boolean' && schema.$id === normalized.$id,
          );
    if (entry) return this.artifact(entry);
    const synthetic = { schema: root, path: ['x-opentyped-root'] };
    const graph = new SchemaGraph([...this.entries, synthetic], this.self);
    return graph.artifact(graph.owner(synthetic.path));
  }

  private owner(path: readonly string[]): SchemaEntry {
    for (let length = path.length; length >= 0; length--) {
      const entry = this.positions.get(stableJson(path.slice(0, length)));
      if (entry) return entry;
    }
    throw new GenerationError(`Missing schema entry for ${stableJson(path)}.`);
  }

  private closure(seeds: readonly SchemaEntry[]): SchemaEntry[] {
    const used = new Set<SchemaEntry>(seeds);
    for (const entry of used)
      for (const target of this.dependencies.get(entry) ?? []) used.add(target);
    return [...used];
  }

  private artifact(root: SchemaEntry): Schema {
    const entries = this.closure([root]);
    const id =
      'urn:oapi:schema:' +
      createHash('sha256')
        .update(stableJson({ entries, root: root.path, self: this.self }))
        .digest('hex');
    const names = new Map<SchemaEntry, string>();
    const reserved = new Set(
      entries
        .filter(({ path }) => path[0] === 'components' && path[1] === 'schemas')
        .map(({ path }) => path[2]!),
    );
    for (const entry of entries) {
      const component = entry.path[0] === 'components' && entry.path[1] === 'schemas';
      let name = component
        ? entry.path[2]!
        : 'schema_' +
          createHash('sha256').update(stableJson(entry.path)).digest('hex').slice(0, 16);
      if (!component) {
        while (reserved.has(name)) name = 'schema_' + name;
        reserved.add(name);
      }
      names.set(entry, name);
    }
    const documentId = id + ':document';
    const reference = (edge: SchemaDependency): string => {
      const target = this.owner(edge.target);
      const fragment = uriResolver.parse(edge.text).fragment;
      const anchor =
        fragment !== undefined && fragment !== '' && !decodeURIComponent(fragment).startsWith('/');
      const base = edge.resource.length ? edge.uri! : documentId;
      if (anchor) return base + '#' + fragment;
      const path = edge.resource.length
        ? edge.target.slice(edge.resource.length)
        : ['$defs', names.get(target)!, ...edge.target.slice(target.path.length)];
      return base + (path.length ? '#/' + path.map(pointer).join('/') : '');
    };
    const definitions: Record<string, Schema> = Object.create(null) as Record<string, Schema>;
    const documentDefinitions: Record<string, Schema> = Object.create(null) as Record<
      string,
      Schema
    >;
    for (const entry of entries) {
      const schema = publicSchema(
        typeof entry.schema === 'boolean' ? (entry.schema ? {} : { not: {} }) : entry.schema,
      );
      visitSchema(schema, (node, relative) => {
        if (typeof node === 'boolean') return;
        const edges = this.references.get(stableJson([...entry.path, ...relative])) ?? [];
        Object.assign(
          node,
          mapReferences(node, (ref, kind) => {
            const edge = edges.find((item) => item.text === ref && item.kind === kind);
            if (!edge) {
              if (ref !== '' && !ref.startsWith('#') && !uriResolver.parse(ref).scheme)
                throw new GenerationError(
                  `Standalone external relative reference ${ref} requires an absolute document $self or owning schema $id.`,
                );
              return ref;
            }
            return reference(edge);
          }),
        );
      });
      (schema.$id === undefined ? documentDefinitions : definitions)[names.get(entry)!] = schema;
    }
    if (Object.keys(documentDefinitions).length)
      definitions.$document = { $id: documentId, $defs: documentDefinitions };
    let rootReference =
      typeof root.schema !== 'boolean' && root.schema.$id !== undefined
        ? root.schema.$id
        : documentId + '#/$defs/' + pointer(names.get(root)!);
    if (
      root.path[0] === 'x-opentyped-root' &&
      typeof root.schema !== 'boolean' &&
      Object.keys(root.schema).every((key) => ['$ref', '$schema'].includes(key))
    ) {
      const edge = this.references.get(stableJson(root.path))?.find(({ kind }) => kind === '$ref');
      if (edge) rootReference = reference(edge);
    }
    return { $schema: DIALECT, $id: id, $ref: rootReference, $defs: definitions };
  }
}
