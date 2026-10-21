import { HeaderRegistry, headerObjects } from '~/document/header';
import { compileContent, compileBodyContent, contentExamples } from '~/document/content';
import type { Source } from '~/diagnostic';
import type { Schema, Components } from '~/schema/definition';
import { namedObjectSchema, isFalseSchema } from '~/schema/shape';
import type { Response } from '~/document/definition';
import type { ReferenceObject } from 'openapi3-ts/oas32';
import { httpMetadata, extensions, schemaExamples, record } from '~/document/metadata';
import { parameterMetadata } from '~/document/parameter';
import { COMPONENTS, componentPath, pointer } from '~/schema/reference';

function compileHeaders(
  schema: Schema,
  components: Components,
  source: Source,
  status: string,
): NonNullable<Response['headers']> {
  const headers = namedObjectSchema(schema, components, source, `Response ${status} headers`);
  const used = new Set<string>();
  return Object.fromEntries(
    Object.entries(headers.properties ?? {}).map(([name, value]) => {
      if (name.toLowerCase() === 'content-type' || used.has(name.toLowerCase()))
        source.fail(`Invalid or duplicate response header ${name}.`);
      used.add(name.toLowerCase());
      return [
        name,
        {
          required: !!headers.required?.includes(name),
          ...parameterMetadata(value, 'header', components, source),
        },
      ];
    }),
  );
}

/** Compiles one response envelope, independently of the HTTP status at its use site. */
/** Registry operations needed while assembling an HTTP response map. */
export interface ResponseLookup {
  readonly headers: HeaderRegistry;
  observe(response: Response, source: Source): void;
  reference(schema: Schema): ReferenceObject | undefined;
}

export function compileResponse(
  schema: Schema,
  components: Components,
  source: Source,
  context: string,
  registry?: HeaderRegistry,
): Response {
  const response = namedObjectSchema(schema, components, source, context);
  const parts = { ...response.properties };
  // An optional forbidden body describes absence, rather than a response representation.
  if (parts.body && !response.required?.includes('body') && isFalseSchema(parts.body, components))
    delete parts.body;
  for (const name of Object.keys(parts))
    if (!['body', 'itemSchema', 'headers', 'contentType', 'content'].includes(name))
      source.fail(`Unknown response field ${name}. Use { body: Model } or EmptyResponse.`);
  const metadata = httpMetadata(schema, components, source, {
    description: 'string',
    example: 'any',
    examples: 'object',
    links: 'object',
    headers: 'object',
  });
  const output: Response = {
    description: (metadata.description as string | undefined) ?? response.description ?? context,
    ...extensions(metadata),
  };
  if (parts.body && parts.content)
    source.fail('Response body and content cannot both be specified.');
  if (parts.content && parts.contentType)
    source.fail('Response contentType cannot override an explicit content map.');
  if (parts.itemSchema) {
    if (!response.required?.includes('itemSchema'))
      source.fail(
        'Response itemSchema must be required; it describes each item, not the stream length.',
      );
    if (!parts.contentType || !response.required?.includes('contentType'))
      source.fail('Response itemSchema requires an explicit required contentType.');
    if (parts.content) source.fail('Response itemSchema cannot override an explicit content map.');
  }
  if (parts.contentType && !response.required?.includes('contentType'))
    source.fail('Response contentType must be required when explicitly declared.');
  if (parts.body || parts.itemSchema) {
    output.content = compileBodyContent(parts, components, source, 'response');
  } else if (parts.contentType) source.fail(`${context}: contentType requires a body.`);
  if (parts.content) output.content = compileContent(parts.content, components, source);
  if (parts.headers) output.headers = compileHeaders(parts.headers, components, source, context);
  if (metadata.headers !== undefined) {
    const additional = headerObjects(metadata.headers, components, source, 'response');
    const used = new Set(Object.keys(output.headers ?? {}).map((name) => name.toLowerCase()));
    for (const name of Object.keys(additional))
      if (used.has(name.toLowerCase()))
        source.fail(`Duplicate response header ${name} across typed and HTTP metadata headers.`);
    output.headers = { ...output.headers, ...additional };
  }
  (registry ?? new HeaderRegistry({}, components, source)).response(output, source);
  contentExamples(
    output.content,
    'example' in metadata || 'examples' in metadata ? metadata : schemaExamples(response, source),
    source,
  );
  if (metadata.links !== undefined) output.links = compileLinks(metadata.links, source);
  return output;
}

export function compileResponses(
  schema: Schema,
  method: string,
  components: Components,
  source: Source,
  registry?: ResponseLookup,
): Record<string, Response | ReferenceObject> {
  const responses = namedObjectSchema(schema, components, source, 'responses');
  if (!Object.keys(responses.properties ?? {}).length)
    source.fail('responses must enumerate at least one HTTP status.');
  const result: Record<string, Response | ReferenceObject> = {};
  for (const [status, schema] of Object.entries(responses.properties ?? {})) {
    if (!/^(default|[1-5](?:\d{2}|XX))$/.test(status))
      source.fail(`Invalid HTTP response status ${status}.`);
    const response = compileResponse(
      schema,
      components,
      source,
      `HTTP ${status}`,
      registry?.headers,
    );
    if (response.content && /^(1(?:\d\d|XX)|204|205|304)$/.test(status))
      source.fail(`Response ${method.toUpperCase()} ${status} cannot have a body.`);
    registry?.observe(response, source);
    result[status] = registry?.reference(schema) ?? response;
  }
  return result;
}

interface ResponseDeclaration {
  schema: Schema;
  source: Source;
}

/** Owns reusable response identities, compilation and references across operations. */
export class ResponseRegistry {
  readonly responses: Record<string, Response> = Object.create(null) as Record<string, Response>;

  private readonly observed: { response: Response; source: Source }[] = [];

  constructor(
    declarations: Record<string, ResponseDeclaration>,
    private readonly schemas: Components,
    readonly headers: HeaderRegistry,
  ) {
    for (const [name, declaration] of Object.entries(declarations)) {
      this.responses[name] = compileResponse(
        declaration.schema,
        schemas,
        declaration.source,
        `Response ${name}`,
        headers,
      );
      this.observe(this.responses[name]!, declaration.source);
    }
  }

  observe(response: Response, source: Source): void {
    this.observed.push({ response, source });
  }

  reference(schema: Schema): ReferenceObject | undefined {
    const seen = new Set<string>();
    let current = schema;
    let description: string | undefined;
    while (current.$ref?.startsWith(COMPONENTS) && !seen.has(current.$ref)) {
      if (current.http !== undefined || current.examples?.length) return undefined;
      description ??= current.description;
      seen.add(current.$ref);
      const path = componentPath(current.$ref);
      if (path?.length !== 1) return undefined;
      const name = path[0]!;
      if (Object.hasOwn(this.responses, name))
        return {
          $ref: `#/components/responses/${pointer(name)}`,
          ...(description !== undefined ? { description } : {}),
        };
      const target = Object.hasOwn(this.schemas, name) ? this.schemas[name] : undefined;
      if (!target) return undefined;
      current = target;
    }
    return undefined;
  }

  payloads(): Schema[] {
    return this.observed.flatMap(({ response, source }) => this.headers.response(response, source));
  }
}

function compileLinks(value: unknown, source: Source): NonNullable<Response['links']> {
  const links = record(value, source, 'links');
  for (const [name, entry] of Object.entries(links)) {
    const link = record(entry, source, `Link ${name}`);
    if ('$ref' in link) {
      if (typeof link.$ref !== 'string') source.fail(`Link ${name} $ref must be a string.`);
      continue;
    }
    if (Number('operationId' in link) + Number('operationRef' in link) !== 1)
      source.fail(`Link ${name} requires exactly one of operationId or operationRef.`);
    for (const [key, value] of Object.entries(link)) {
      if (key.startsWith('x-') || key === 'requestBody') continue;
      if (['operationId', 'operationRef', 'description'].includes(key)) {
        if (typeof value !== 'string' || !value) source.fail(`Invalid link ${name}.${key}.`);
      } else if (key === 'parameters') record(value, source, `Link ${name} parameters`);
      else if (key === 'server') {
        const server = record(value, source, `Link ${name} server`);
        if (typeof server.url !== 'string') source.fail(`Link ${name} server requires a url.`);
      } else source.fail(`Unknown link field ${key}.`);
    }
  }
  return links as NonNullable<Response['links']>;
}
