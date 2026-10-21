import { mediaType } from '~/document/media';
import { httpMetadata, examples, schemaExamples, extensions } from '~/document/metadata';
import type { Metadata } from '~/document/metadata';
import { publicSchema } from '~/schema/public';
import type { Source } from '~/diagnostic';
import type { Schema, Components } from '~/schema/definition';
import { dereference } from '~/schema/graph';
import { namedObjectSchema, scalarSchema } from '~/schema/shape';
import type { Parameter, HeaderRepresentation } from '~/document/definition';

type Style = Pick<Parameter, 'style' | 'explode'>;

/** HTTP parameter encodings are intentionally narrower than arbitrary JSON bodies. */
export function parameterStyle(
  schema: Schema,
  location: string,
  components: Components,
  source: Source,
  metadata: Metadata = {},
): Style {
  const value = dereference(schema, components);
  const scalar = scalarSchema(value, components);
  const scalarArray = (schema: Schema, depth = 0): boolean => {
    if (depth >= 100) return false;
    const part = dereference(schema, components);
    const alternatives = part.anyOf ?? part.oneOf;
    if (alternatives) return alternatives.every((child) => scalarArray(child, depth + 1));
    return (
      (part.type === 'array' && !!part.items && scalarSchema(part.items, components)) ||
      !!part.allOf?.some((child) => scalarArray(child, depth + 1))
    );
  };
  const array = scalarArray(value);
  const object =
    value.type === 'object' &&
    [
      ...Object.values(value.properties ?? {}),
      ...Object.values(value.patternProperties ?? {}),
    ].every((part) => scalarSchema(part, components)) &&
    (value.additionalProperties === false ||
      (typeof value.additionalProperties === 'object' &&
        scalarSchema(value.additionalProperties, components)));
  if (!scalar && !array && !object)
    return source.fail(
      `${location} parameter has ambiguous serialization. Use scalars, scalar arrays, or a flat object; put nested data in a JSON body.`,
    );
  const style =
    metadata.style ??
    (object && location === 'query'
      ? 'deepObject'
      : ['query', 'cookie'].includes(location)
        ? 'form'
        : 'simple');
  const allowed: Record<string, string[]> = {
    query: ['form', 'spaceDelimited', 'pipeDelimited', 'deepObject'],
    path: ['simple', 'label', 'matrix'],
    header: ['simple'],
    cookie: ['form', 'cookie'],
  };
  if (typeof style !== 'string' || !allowed[location]?.includes(style))
    source.fail(`Invalid ${location} parameter style ${String(style)}.`);
  if (style === 'deepObject' && (!object || metadata.explode === false))
    source.fail('deepObject requires a flat object and explode: true.');
  if (
    ['spaceDelimited', 'pipeDelimited'].includes(style) &&
    ((!array && !object) || metadata.explode === true)
  )
    source.fail(`${style} requires a scalar array or flat object and explode: false.`);
  if (metadata.allowReserved !== undefined && location !== 'query')
    source.fail('allowReserved is only supported on query parameters.');
  return {
    ...(metadata.style !== undefined || object
      ? { style: style as NonNullable<Parameter['style']> }
      : {}),
    ...(metadata.explode !== undefined
      ? { explode: metadata.explode as boolean }
      : style === 'deepObject'
        ? { explode: true }
        : {}),
  };
}

export function parameterMetadata(
  schema: Schema,
  location: string,
  components: Components,
  source: Source,
): Pick<
  Parameter,
  'description' | 'deprecated' | 'example' | 'examples' | 'style' | 'explode' | 'allowReserved'
> &
  HeaderRepresentation {
  const metadata = httpMetadata(schema, components, source, {
    contentType: 'string',
    description: 'string',
    deprecated: 'boolean',
    style: 'string',
    explode: 'boolean',
    allowReserved: 'boolean',
    example: 'any',
    examples: 'object',
  });
  const resolved = dereference(schema, components);
  const sample = examples(
    'example' in metadata || 'examples' in metadata ? metadata : schemaExamples(resolved, source),
    source,
  );
  let representation: HeaderRepresentation &
    Pick<Parameter, 'style' | 'explode' | 'example' | 'examples'>;
  if (metadata.contentType !== undefined) {
    if (['style', 'explode', 'allowReserved'].some((key) => Object.hasOwn(metadata, key)))
      source.fail('Content-based parameters cannot specify style, explode or allowReserved.');
    const name = mediaType(metadata.contentType as string, source);
    representation = { content: { [name]: { schema: publicSchema(schema), ...sample } } };
  } else {
    representation = {
      schema: publicSchema(schema),
      ...sample,
      ...parameterStyle(schema, location, components, source, metadata),
    };
  }
  return {
    ...(typeof (metadata.description ?? resolved.description) === 'string'
      ? { description: (metadata.description ?? resolved.description) as string }
      : {}),
    ...(typeof (metadata.deprecated ?? resolved.deprecated) === 'boolean'
      ? { deprecated: (metadata.deprecated ?? resolved.deprecated) as boolean }
      : {}),
    ...(metadata.allowReserved !== undefined
      ? { allowReserved: metadata.allowReserved as boolean }
      : {}),
    ...representation,
    ...extensions(metadata),
  };
}

function checkHeader(name: string, used: Set<string>, source: Source): void {
  const normalized = name.toLowerCase();
  if (used.has(normalized)) source.fail(`Duplicate header ${name}.`);
  used.add(normalized);
  if (['accept', 'content-type', 'authorization'].includes(normalized))
    source.fail(`Header ${name} must be described using content types or security schemes.`);
}

export function compileParameters(
  fields: Record<string, Schema>,
  pathNames: string[],
  components: Components,
  source: Source,
): Parameter[] {
  const parameters: Parameter[] = [];
  for (const [field, location] of [
    ['params', 'path'],
    ['query', 'query'],
    ['headers', 'header'],
    ['cookies', 'cookie'],
  ] as const) {
    const schema = fields[field];
    if (!schema) continue;
    const group = namedObjectSchema(schema, components, source, field);
    const headers = new Set<string>();
    for (const [name, parameter] of Object.entries(group.properties ?? {})) {
      if (location === 'path' && !pathNames.includes(name)) {
        if (!group.required?.includes(name)) continue;
        source.fail(`Required path parameter ${name} must occur in the route.`);
      }
      if (location === 'header') checkHeader(name, headers, source);
      parameters.push({
        name,
        in: location,
        required: location === 'path' || !!group.required?.includes(name),
        ...parameterMetadata(parameter, location, components, source),
      });
    }
  }
  return parameters;
}
