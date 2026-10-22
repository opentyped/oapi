import type ts from 'typescript';
import { discriminatedUnion } from '@opentyped/openapi/schema/graph';
import { visitSchema } from '@opentyped/openapi/schema/visitor';
import type { Schema as ResourceSchema } from '@opentyped/openapi/schema/definition';
import type { Schema, SchemaDestination } from '~/definition';
import { schemaEntries, schemaCatalog } from '~/destination';
import { SchemaError } from '~/error';

/** Resolve discriminator annotations against completed, identity-bearing variants. */
export function discriminatorDefinitions(
  definitions: Record<string, Schema>,
  destination: SchemaDestination,
  source: ts.Node,
): void {
  const marked: { schema: ResourceSchema; name: string }[] = [];
  for (const value of Object.values(definitions))
    visitSchema(value as ResourceSchema, (schema) => {
      if (typeof schema === 'object' && typeof schema.discriminator === 'string') {
        marked.push({ schema, name: schema.discriminator });
        delete schema.discriminator;
      }
    });
  if (!marked.length) return;
  const positions = new Map<string, ResourceSchema | boolean>();
  const origins = new WeakMap<ResourceSchema, readonly string[]>();
  for (const entry of schemaEntries(definitions, destination))
    visitSchema(entry.schema, (schema, relative) => {
      const path = [...entry.path, ...relative];
      positions.set(JSON.stringify(path), schema);
      if (typeof schema === 'object') origins.set(schema, path);
    });
  const catalog = schemaCatalog(definitions, destination);
  const resolve = (input: ResourceSchema | boolean): ResourceSchema => {
    let schema = input;
    const active = new Set<ResourceSchema>();
    while (typeof schema === 'object' && typeof schema.$ref === 'string') {
      if (active.has(schema) || active.size >= 100)
        throw new SchemaError(
          'Discriminator reference lookup exceeds its traversal budget',
          source,
        );
      active.add(schema);
      const path = catalog.resolve(schema.$ref, origins.get(schema));
      const target = path && positions.get(JSON.stringify(path));
      if (target === undefined)
        throw new SchemaError(`Cannot resolve discriminator reference ${schema.$ref}`, source);
      schema = target;
    }
    if (typeof schema !== 'object')
      throw new SchemaError('Discriminator variants and tags require concrete schemas', source);
    return schema;
  };
  const literals = (input: ResourceSchema | boolean, depth = 0): unknown[] => {
    if (depth >= 100) throw new SchemaError('Discriminator tag lookup exceeds 100 levels', source);
    const schema = resolve(input);
    if (Object.hasOwn(schema, 'const')) return [schema.const];
    if (Array.isArray(schema.enum)) return schema.enum;
    if (schema.anyOf) return schema.anyOf.flatMap((part) => literals(part, depth + 1));
    throw new SchemaError('Discriminator tags must be string literals', source);
  };
  for (const { schema, name } of marked) {
    const union = resolve(schema);
    const branches = union.anyOf ?? union.oneOf;
    if (!branches?.length || (union.type !== undefined && union.type !== 'object'))
      throw new SchemaError('Discriminator annotations require an object union', source);
    const variants = branches.map((variant) => {
      if (typeof variant !== 'object' || typeof variant.$ref !== 'string')
        throw new SchemaError('Discriminator variants must be named object types', source);
      const object = resolve(variant);
      const tag = object.properties?.[name];
      if (object.type !== 'object' || !object.required?.includes(name) || tag === undefined)
        throw new SchemaError(
          `Discriminator property ${name} must be required in every variant`,
          source,
        );
      return { schema: variant, values: literals(tag) };
    });
    const result = discriminatedUnion(name, variants);
    const required = [...new Set([...(schema.required ?? []), ...result.required])];
    const assertions = [...(schema.allOf ?? [])];
    if (schema.$ref) assertions.push({ $ref: schema.$ref });
    if (schema.anyOf && schema.oneOf) assertions.push({ oneOf: schema.oneOf });
    delete schema.$ref;
    delete schema.anyOf;
    Object.assign(schema, result, { required }, assertions.length ? { allOf: assertions } : {});
  }
}
