import { DEFAULT_OPENAPI } from '~/document/definition';
import { httpMetadata, extensions, examples, schemaExamples } from '~/document/metadata';
import type { Source } from '~/diagnostic';
import type { Components, Schema } from '~/schema/definition';
import { namedObjectSchema } from '~/schema/shape';
import {
  compileContent,
  compileMedia,
  contentExamples,
  mediaType,
  compileBodyContent,
} from '~/document/content';
import type { RequestBody, Parameter, DocumentOptions } from '~/document/definition';

export function compileRequest(
  contract: Schema,
  annotations: ReadonlyMap<string, string>,
  components: Components,
  source: Source,
): RequestBody | undefined {
  const fields = contract.properties ?? {};
  if (!fields.body && !fields.requestBody) {
    if (annotations.has('requestContentType'))
      source.fail('requestContentType requires a body contract.');
    return undefined;
  }
  if (fields.body && fields.requestBody)
    source.fail('body and requestBody cannot both be specified.');
  if (fields.body) {
    const name = mediaType(annotations.get('requestContentType') ?? 'application/json', source);
    return {
      required: !!contract.required?.includes('body'),
      content: { [name]: compileMedia(fields.body, name, 'request', components, source) },
    };
  }
  if (annotations.has('requestContentType'))
    source.fail('requestContentType cannot override an explicit requestBody definition.');
  const request = namedObjectSchema(fields.requestBody!, components, source, 'requestBody');
  const parts = request.properties ?? {};
  const stream = parts.itemSchema;
  const allowed = stream ? ['body', 'itemSchema', 'contentType'] : ['content'];
  for (const key of Object.keys(parts))
    if (!allowed.includes(key)) source.fail(`Unknown requestBody field ${key}.`);
  if (stream) {
    if (!request.required?.includes('itemSchema'))
      source.fail('Request itemSchema must be required; it describes each stream item.');
    if (!parts.contentType || !request.required?.includes('contentType'))
      source.fail('Request itemSchema requires an explicit required contentType.');
  } else if (!parts.content) return source.fail('requestBody requires content or itemSchema.');
  if (!stream && !request.required?.includes('content'))
    source.fail(
      'requestBody.content must be required. Make requestBody optional for an optional body.',
    );
  const metadata = httpMetadata(fields.requestBody!, components, source, {
    description: 'string',
    example: 'any',
    examples: 'object',
  });
  const compiled = stream
    ? compileBodyContent(parts, components, source, 'request')
    : compileContent(parts.content!, components, source, 'request');
  contentExamples(
    compiled,
    'example' in metadata || 'examples' in metadata ? metadata : schemaExamples(request, source),
    source,
  );
  return {
    required: !!contract.required?.includes('requestBody'),
    content: compiled,
    ...extensions(metadata),
    ...(metadata.description !== undefined || request.description
      ? { description: (metadata.description ?? request.description) as string }
      : {}),
  };
}

/** Describes the complete serialized URL query using the existing media-content compiler. */
export function compileQueryString(
  contract: Schema,
  components: Components,
  source: Source,
  version: DocumentOptions['openapi'] = DEFAULT_OPENAPI,
): Parameter | undefined {
  const fields = contract.properties ?? {};
  if (!fields.querystring) return undefined;
  if (version !== '3.2.0') source.fail('querystring parameters require OpenAPI 3.2.0.');
  if (fields.query) source.fail('query and querystring cannot both be specified.');
  const query = namedObjectSchema(fields.querystring, components, source, 'querystring');
  const parts = query.properties ?? {};
  for (const key of Object.keys(parts))
    if (key !== 'content') source.fail(`Unknown querystring field ${key}.`);
  if (!parts.content || !query.required?.includes('content'))
    return source.fail('querystring requires a required content map.');
  const content = compileContent(parts.content, components, source, 'request');
  if (Object.keys(content).length !== 1)
    source.fail('querystring content must contain exactly one media type.');
  const metadata = httpMetadata(fields.querystring, components, source, {
    description: 'string',
    deprecated: 'boolean',
    example: 'any',
    examples: 'object',
  });
  return {
    name: 'query',
    in: 'querystring',
    required: !!contract.required?.includes('querystring'),
    content,
    ...examples(
      'example' in metadata || 'examples' in metadata ? metadata : schemaExamples(query, source),
      source,
    ),
    ...(metadata.description !== undefined || query.description
      ? { description: (metadata.description ?? query.description) as string }
      : {}),
    ...(metadata.deprecated !== undefined || query.deprecated !== undefined
      ? { deprecated: (metadata.deprecated ?? query.deprecated) as boolean }
      : {}),
    ...extensions(metadata),
  };
}
