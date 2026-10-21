import { GenerationError } from '~/diagnostic';
import type { Source } from '~/diagnostic';
import type { Extensions, JsonValue } from '~/json';
import type { Components, Schema } from '~/schema/definition';
import { dereference } from '~/schema/graph';
import type { MediaContent } from '~/document/definition';

export type Metadata = Record<string, unknown>;

/** Validates operation-group tags without splitting names that contain commas. */
export function tagNames(value: unknown, context = 'Operation tags'): string[] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    !Array.from(value).every((tag) => typeof tag === 'string' && tag.trim())
  )
    throw new GenerationError(`${context} must be an array of nonempty strings.`);
  return [...new Set(value as string[])];
}

export function record(value: unknown, source: Source, context: string): Metadata {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return source.fail(`${context} must be an object.`);
  return value as Metadata;
}

function jsonValue(value: unknown, source: Source, depth = 0): void {
  if (depth > 100) source.fail('HTTP metadata exceeds the JSON nesting budget.');
  if (typeof value === 'number' && !Number.isFinite(value))
    source.fail('HTTP metadata numbers must be finite JSON values.');
  if (value && typeof value === 'object')
    for (const child of Object.values(value)) jsonValue(child, source, depth + 1);
}

/** Annotations are data; they never execute expressions or import application modules. */
export function httpMetadata(
  schema: Schema,
  components: Components,
  source: Source,
  fields: Record<string, 'string' | 'boolean' | 'object' | 'any'>,
): Metadata {
  const value = dereference(schema, components).http;
  if (value === undefined) return {};
  const metadata = record(value, source, 'http metadata');
  jsonValue(metadata, source);
  for (const [key, value] of Object.entries(metadata)) {
    if (key.startsWith('x-')) continue;
    const expected = fields[key];
    if (!expected) source.fail(`Unsupported HTTP metadata field ${key} in this context.`);
    if (expected === 'object') record(value, source, key);
    else if (expected !== 'any' && typeof value !== expected)
      source.fail(`HTTP metadata ${key} must be ${expected}.`);
  }
  return metadata;
}

export function examples(
  metadata: Metadata,
  source: Source,
): Pick<MediaContent, 'example' | 'examples'> {
  jsonValue(metadata, source);
  if (Object.hasOwn(metadata, 'example') && Object.hasOwn(metadata, 'examples'))
    source.fail('example and examples are mutually exclusive.');
  if (Object.hasOwn(metadata, 'example')) return { example: metadata.example };
  if (!metadata.examples) return {};
  const entries = record(metadata.examples, source, 'examples');
  for (const [name, value] of Object.entries(entries)) {
    const example = record(value, source, `Example ${name}`);
    if ('$ref' in example) {
      if (typeof example.$ref !== 'string') source.fail(`Example ${name} $ref must be a string.`);
      continue;
    }
    for (const key of Object.keys(example))
      if (
        !['summary', 'description', 'value', 'externalValue'].includes(key) &&
        !key.startsWith('x-')
      )
        source.fail(`Unknown example field ${key}.`);
    if (Object.hasOwn(example, 'value') && Object.hasOwn(example, 'externalValue'))
      source.fail(`Example ${name}: value and externalValue are mutually exclusive.`);
    for (const key of ['summary', 'description', 'externalValue'])
      if (key in example && typeof example[key] !== 'string')
        source.fail(`Example ${name} ${key} must be a string.`);
  }
  return { examples: entries as NonNullable<MediaContent['examples']> };
}

export function schemaExamples(schema: Schema, source: Source): Metadata {
  const values = schema.examples;
  if (values === undefined) return {};
  if (!Array.isArray(values)) return source.fail('Schema examples must be an array.');
  if (!values.length) return {};
  return values.length === 1
    ? { example: values[0] }
    : {
        examples: Object.fromEntries(
          values.map((value: unknown, index: number) => [`example${index + 1}`, { value }]),
        ),
      };
}

export function extensions(metadata: Metadata): Metadata {
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => key.startsWith('x-')));
}

function copyJson(
  value: unknown,
  source: Source,
  active: Set<object>,
  budget: { nodes: number },
): JsonValue {
  if (++budget.nodes > 10000 || active.size >= 100)
    return source.fail('Extensions exceed the JSON traversal budget.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object' || !value)
    return source.fail('Extensions must contain finite JSON values only.');
  if (active.has(value))
    return source.fail('Extensions cannot contain circular JavaScript values.');
  if (Object.getOwnPropertySymbols(value).length)
    return source.fail('Extensions cannot contain symbol properties.');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const descriptor of Object.values(descriptors))
    if (descriptor.get || descriptor.set)
      return source.fail('Extensions cannot contain getters or setters.');
  const branch = new Set(active).add(value);
  if (Array.isArray(value)) {
    if (value.length > 10000) return source.fail('Extensions exceed the JSON traversal budget.');
    for (let i = 0; i < value.length; i++)
      if (!Object.hasOwn(value, i)) return source.fail('Extensions cannot contain sparse arrays.');
    return value.map((item: unknown) => copyJson(item, source, branch, budget));
  }
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    return source.fail('Extensions require plain JSON objects.');
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, copyJson(item, source, branch, budget)]),
  );
}

/** Extension values are isolated JSON data, never OpenAPI reference containers. */
export function specificationExtensions(value: unknown, source: Source): Extensions {
  const object = record(value, source, 'Extensions');
  for (const key of Object.keys(object))
    if (!key.startsWith('x-')) return source.fail(`Extension key ${key} must start with x-.`);
  return copyJson(object, source, new Set(), { nodes: 0 }) as Extensions;
}
