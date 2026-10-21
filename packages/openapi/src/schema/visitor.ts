import type { Schema } from '~/schema/definition';

const maps = [
  'properties',
  'patternProperties',
  '$defs',
  'definitions',
  'dependentSchemas',
] as const;
const lists = ['allOf', 'anyOf', 'oneOf', 'prefixItems'] as const;
const singles = [
  'items',
  'additionalProperties',
  'additionalItems',
  'not',
  'if',
  'then',
  'else',
  'contains',
  'propertyNames',
  'unevaluatedProperties',
  'unevaluatedItems',
  'contentSchema',
] as const;

/** Visits schema positions only: examples, defaults and const values are opaque data. */
export function mapSchema(schema: Schema, transform: (schema: Schema) => Schema): Schema {
  if (typeof schema === 'boolean') return transform(schema ? {} : { not: {} });
  const result = { ...schema };
  for (const key of maps) {
    const values = result[key] as Record<string, Schema> | undefined;
    if (values)
      result[key] = Object.fromEntries(
        Object.entries(values).map(([name, value]) => [name, mapSchema(value, transform)]),
      );
  }
  for (const key of lists) {
    const values = result[key] as Schema[] | undefined;
    if (values) result[key] = values.map((value) => mapSchema(value, transform));
  }
  for (const key of singles) {
    const value = result[key];
    if (value && typeof value === 'object' && !Array.isArray(value))
      result[key] = mapSchema(value as Schema, transform);
    else if (key === 'items' && Array.isArray(value))
      (result as Record<string, unknown>)[key] = value.map((item: Schema) =>
        mapSchema(item, transform),
      );
  }
  return transform(result);
}

/** Preorder schema positions retain lexical paths and boolean targets for resource scoping. */
export function visitSchema(
  schema: Schema | boolean,
  visit: (schema: Schema | boolean, path: readonly string[]) => void,
): void {
  let nodes = 0;
  const walk = (value: Schema | boolean, path: string[]): void => {
    if (++nodes > 100000 || path.length > 400)
      throw new Error('Schema resource exceeds the traversal budget.');
    visit(value, path);
    if (typeof value === 'boolean') return;
    for (const key of maps) {
      const entries = value[key] as Record<string, Schema | boolean> | undefined;
      if (entries)
        for (const [name, child] of Object.entries(entries)) walk(child, [...path, key, name]);
    }
    for (const key of lists) {
      const entries = value[key] as (Schema | boolean)[] | undefined;
      entries?.forEach((child, index) => walk(child, [...path, key, String(index)]));
    }
    for (const key of singles) {
      const child = value[key];
      if (
        typeof child === 'boolean' ||
        (child && typeof child === 'object' && !Array.isArray(child))
      )
        walk(child as Schema | boolean, [...path, key]);
      else if (key === 'items' && Array.isArray(child))
        child.forEach((item: Schema | boolean, index: number) =>
          walk(item, [...path, key, String(index)]),
        );
    }
  };
  walk(schema, []);
}
