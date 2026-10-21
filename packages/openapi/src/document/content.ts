import { mediaType, mediaIdentity, mediaBase } from '~/document/media';
import { httpMetadata, examples, schemaExamples, extensions, record } from '~/document/metadata';
import type { Metadata } from '~/document/metadata';
import { publicSchema } from '~/schema/public';
import type { Source } from '~/diagnostic';
import type { Components, Schema } from '~/schema/definition';
import { dereference } from '~/schema/graph';
import { objectSchema, namedObjectSchema } from '~/schema/shape';
import type { Content, MediaContent } from '~/document/definition';
import { headerObjects } from '~/document/header';
import { parameterStyle } from '~/document/parameter';

export { mediaType } from '~/document/media';

function literalMediaType(
  schema: Schema | undefined,
  components: Components,
  source: Source,
): string {
  if (!schema) return 'application/json';
  const value = dereference(schema, components);
  const literal = value.const ?? (value.enum?.length === 1 ? value.enum[0] : undefined);
  if (typeof literal !== 'string')
    return source.fail(
      'contentType must be one literal media type, such as "application/problem+json".',
    );
  return mediaType(literal, source);
}

/** Media-type map values are payload types; HTTP envelope metadata never becomes payload schema. */
export function compileContent(
  schema: Schema,
  components: Components,
  source: Source,
  kind: 'request' | 'response' = 'response',
): Record<string, MediaContent> {
  const content = namedObjectSchema(schema, components, source, 'content');
  const properties = content.properties ?? {};
  if (!Object.keys(properties).length)
    source.fail('content must enumerate at least one media type.');
  const used = new Set<string>();
  return Object.fromEntries(
    Object.entries(properties).map(([name, value]) => {
      mediaType(name, source);
      const identity = mediaIdentity(name, source);
      if (used.has(identity)) source.fail(`Duplicate media type ${name}.`);
      used.add(identity);
      return [name, compileMedia(value, name, kind, components, source)];
    }),
  );
}

/** Assemble a complete body schema, per-item schema, or both from an HTTP envelope. */
export function compileBodyContent(
  parts: Readonly<Record<string, Schema>>,
  components: Components,
  source: Source,
  kind: 'request' | 'response',
): Record<string, MediaContent> {
  const payload = parts.body ?? parts.itemSchema;
  if (!payload) return source.fail('Media content requires body or itemSchema.');
  const name = literalMediaType(parts.contentType, components, source);
  const media = compileMedia(
    payload,
    name,
    kind,
    components,
    source,
    parts.body ? 'schema' : 'itemSchema',
  );
  if (parts.body && parts.itemSchema) media.itemSchema = publicSchema(parts.itemSchema);
  return { [name]: media };
}

/** Metadata on a media-map property belongs to the media object, not to its payload schema. */
export function compileMedia(
  payload: Schema,
  name: string,
  kind: 'request' | 'response',
  components: Components,
  source: Source,
  representation: 'schema' | 'itemSchema' = 'schema',
): MediaContent {
  const metadata = httpMetadata(payload, components, source, {
    example: 'any',
    examples: 'object',
    encoding: 'object',
  });
  const resolved = dereference(payload, components);
  const output: MediaContent = {
    [representation]: publicSchema(payload),
    ...examples(
      'example' in metadata || 'examples' in metadata
        ? metadata
        : representation === 'schema'
          ? schemaExamples(resolved, source)
          : {},
      source,
    ),
    ...extensions(metadata),
  };
  if (metadata.encoding !== undefined)
    output.encoding = compileEncoding(metadata.encoding, payload, name, kind, components, source);
  return output;
}

export function contentExamples(
  content: Content | undefined,
  metadata: Metadata,
  source: Source,
): void {
  if (!content && ('example' in metadata || 'examples' in metadata))
    source.fail('Media examples require response/request content.');
  for (const entry of Object.values(content ?? {})) {
    if ('example' in metadata || 'examples' in metadata) {
      if ('$ref' in entry) source.fail('Media examples cannot override a media type reference.');
      delete entry.example;
      delete entry.examples;
      Object.assign(entry, examples(metadata, source));
    }
  }
}

function compileEncoding(
  value: unknown,
  payload: Schema,
  media: string,
  kind: 'request' | 'response',
  components: Components,
  source: Source,
): NonNullable<MediaContent['encoding']> {
  const type = mediaBase(media, source);
  if (
    kind !== 'request' ||
    !(type.startsWith('multipart/') || type === 'application/x-www-form-urlencoded')
  )
    source.fail(
      'encoding is only supported for multipart or application/x-www-form-urlencoded requests.',
    );
  const fields =
    objectSchema(payload, components, source, 'Encoded request payload').properties ?? {};
  const encoding = record(value, source, 'encoding');
  for (const [name, entry] of Object.entries(encoding)) {
    const metadata = record(entry, source, `Encoding ${name}`);
    const field = fields[name];
    if (!field) source.fail(`Encoding ${name} does not name a request payload property.`);
    for (const [key, value] of Object.entries(metadata)) {
      if (key.startsWith('x-')) continue;
      if (key === 'headers') {
        if (!type.startsWith('multipart/'))
          source.fail('Encoding headers require a multipart request.');
        metadata.headers = headerObjects(value, components, source);
        continue;
      }
      if (!['contentType', 'style', 'explode', 'allowReserved'].includes(key))
        source.fail(`Unsupported encoding field ${key}.`);
      if (typeof value !== (['explode', 'allowReserved'].includes(key) ? 'boolean' : 'string'))
        source.fail(`Invalid encoding ${name}.${key}.`);
    }
    if (metadata.style !== undefined || metadata.explode !== undefined)
      parameterStyle(field!, 'query', components, source, metadata);
  }
  return encoding as NonNullable<MediaContent['encoding']>;
}
