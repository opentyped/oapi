import type ts from 'typescript';
import { inlineReferences } from '@typedapi/openapi/schema/graph';
import { mapSchema, visitSchema } from '@typedapi/openapi/schema/visitor';
import type { Schema as ResourceSchema } from '@typedapi/openapi/schema/definition';
import type { Schema, SchemaDestination } from '~/definition';
import { schemaEntries, schemaCatalog } from '~/destination';
import { SchemaError } from '~/error';

const scopeKeys = ['$id', '$anchor', '$dynamicAnchor', '$dynamicRef'];

/** Apply inline annotations only after all named definitions have completed. */
export function inlineDefinitions(
  definitions: Record<string, Schema>,
  destination: SchemaDestination,
  source: ts.Node,
): void {
  const marked = (schema: ResourceSchema): boolean => {
    let found = false;
    visitSchema(schema, (node) => {
      if (typeof node === 'object' && node.inline !== undefined) found = true;
    });
    return found;
  };
  if (
    !Object.values(definitions).some(
      (schema) => typeof schema === 'object' && marked(schema as ResourceSchema),
    )
  )
    return;
  const templates = structuredClone(definitions);
  const context = { ...destination, entries: structuredClone(destination.entries ?? []) };
  const catalog = schemaCatalog(templates, context);
  const positions = new Map<string, ResourceSchema | boolean>();
  const scopes: (readonly string[])[] = [];
  for (const entry of schemaEntries(templates, context))
    visitSchema(entry.schema, (node, relative) => {
      const path = [...entry.path, ...relative];
      positions.set(JSON.stringify(path), node);
      if (typeof node === 'object' && scopeKeys.some((key) => key in node)) {
        scopes.push(path);
        visitSchema(node, (child) => {
          if (typeof child === 'object' && child.inline === true)
            throw new SchemaError(
              'Inline annotations inside schema resource scopes are unsupported',
              source,
            );
        });
      }
    });
  const resolve = (ref: string): ResourceSchema => {
    const path = catalog.resolve(ref);
    if (!path) throw new SchemaError(`Cannot inline unresolved reference ${ref}`, source);
    if (scopes.some((scope) => scope.every((token, index) => path[index] === token)))
      throw new SchemaError(`Cannot inline ${ref} outside its schema resource scope`, source);
    const target = positions.get(JSON.stringify(path));
    if (target === undefined)
      throw new SchemaError(`Inline reference must target a schema: ${ref}`, source);
    visitSchema(target, (node) => {
      if (typeof node === 'object' && scopeKeys.some((key) => key in node))
        throw new SchemaError(
          `Cannot duplicate schema resource scopes while inlining ${ref}`,
          source,
        );
    });
    return typeof target === 'boolean' ? (target ? {} : { not: {} }) : target;
  };
  let expansions = 0;
  const embed = (schema: ResourceSchema, active = new Set<string>(), depth = 0): ResourceSchema => {
    if (depth > 100) throw new SchemaError('Inline annotations exceed 100 levels', source);
    if (!marked(schema)) return schema;
    return mapSchema(schema, (item) => {
      const result = { ...item };
      const inline = result.inline;
      delete result.inline;
      if (inline === undefined || inline === false) return result;
      if (inline !== true) throw new SchemaError('@inline requires true or false', source);
      if (result.$ref && active.has(result.$ref)) return result;
      if (++expansions > 10_000)
        throw new SchemaError('Inline annotations exceed 10000 expansions', source);
      const branch = new Set(active);
      if (result.$ref) branch.add(result.$ref);
      return embed(inlineReferences(result, resolve), branch, depth + 1);
    });
  };
  try {
    for (const [name, schema] of Object.entries(definitions))
      if (typeof schema === 'object') definitions[name] = embed(schema as ResourceSchema);
  } catch (error) {
    if (error instanceof SchemaError) throw error;
    throw new SchemaError(error instanceof Error ? error.message : String(error), source);
  }
}
