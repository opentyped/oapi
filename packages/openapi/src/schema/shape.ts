import type { Source } from '~/diagnostic';
import type { Schema, Components } from '~/schema/definition';
import { dereference } from '~/schema/graph';
import { componentPath } from '~/schema/reference';

export function objectSchema(
  schema: Schema,
  components: Components,
  source: Source,
  context: string,
): Schema {
  const result = dereference(schema, components);
  if (result.type !== 'object' || result.anyOf || result.oneOf || result.allOf)
    source.fail(`${context} must be a concrete object with named properties.`);
  return result;
}

/** Metadata carriers require known fields; payload objects may remain open dictionaries. */
export function namedObjectSchema(
  schema: Schema,
  components: Components,
  source: Source,
  context: string,
): Schema {
  const result = objectSchema(schema, components, source, context);
  if (result.additionalProperties !== false || Object.keys(result.patternProperties ?? {}).length)
    source.fail(
      `${context} must enumerate named fields; dynamic index signatures are not supported here.`,
    );
  return result;
}

export function scalarSchema(schema: Schema, components: Components, depth = 0): boolean {
  if (depth >= 100) return false;
  const value = dereference(schema, components);
  if (value.allOf?.some((part) => scalarSchema(part, components, depth + 1))) return true;
  const alternatives = value.anyOf ?? value.oneOf;
  if (alternatives) return alternatives.every((part) => scalarSchema(part, components, depth + 1));
  const types = Array.isArray(value.type) ? value.type : [value.type];
  return types.every(
    (type) => typeof type === 'string' && ['string', 'number', 'integer', 'boolean'].includes(type),
  );
}

/** Recognize schemas proven false by explicit boolean assertions, without general satisfiability inference. */
export function isFalseSchema(schema: Schema, components: Components, depth = 0): boolean {
  if (depth >= 100) return false;
  const value = schema;
  if (value.not && typeof value.not === 'object' && Object.keys(value.not).length === 0)
    return true;
  if (value.allOf?.some((part) => isFalseSchema(part, components, depth + 1))) return true;
  const alternatives = value.anyOf ?? value.oneOf;
  if (
    alternatives?.length &&
    alternatives.every((part) => isFalseSchema(part, components, depth + 1))
  )
    return true;
  const path = value.$ref && componentPath(value.$ref);
  if (path?.length === 1 && Object.hasOwn(components, path[0]!))
    return isFalseSchema(components[path[0]!]!, components, depth + 1);
  return false;
}
