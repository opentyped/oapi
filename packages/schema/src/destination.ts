import { SchemaResource } from '@opentyped/oapi-openapi/schema/resource';
import { formatPointer } from '@opentyped/oapi-openapi/pointer';
import type { SchemaEntry, SchemaCatalog } from '@opentyped/oapi-openapi/schema/resource';
import type { Schema as ResourceSchema } from '@opentyped/oapi-openapi/schema/definition';
import type { Schema, SchemaDestination } from '~/definition';

export function schemaReference(name: string, path: readonly string[]): string {
  return formatPointer([...path, name], true);
}

/** Resource validation always sees the final document positions, including supplied schemas. */
export function schemaEntries(
  definitions: Readonly<Record<string, Schema>>,
  destination: SchemaDestination,
): readonly SchemaEntry[] {
  const own = Object.entries(definitions).map(([name, schema]) => ({
    schema: schema as ResourceSchema | boolean,
    path: [...destination.path, name],
  }));
  const paths = new Set(own.map((entry) => JSON.stringify(entry.path)));
  for (const entry of destination.entries ?? []) {
    const key = JSON.stringify(entry.path);
    if (paths.has(key)) throw new Error('Duplicate schema destination path: ' + key);
    paths.add(key);
  }
  const entries: readonly SchemaEntry[] =
    destination.path.length === 1 && destination.path[0] === '$defs'
      ? [
          {
            schema: {
              $schema: 'https://json-schema.org/draft/2020-12/schema',
              $defs: definitions as Record<string, ResourceSchema>,
            },
            path: [],
          },
        ]
      : own;
  return [...entries, ...(destination.entries ?? [])];
}

export function schemaCatalog(
  definitions: Readonly<Record<string, Schema>>,
  destination: SchemaDestination,
): SchemaCatalog {
  return new SchemaResource(
    schemaEntries(definitions, destination),
    destination.baseUri === undefined &&
      destination.path.length === 1 &&
      destination.path[0] === '$defs'
      ? 'standalone'
      : 'document',
    destination.baseUri,
    destination.pending,
  ).validate();
}
