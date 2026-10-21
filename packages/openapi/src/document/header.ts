import { parsePointer } from '~/pointer';
import { referenceObject } from '~/document/reference';
import type { ReferenceObject } from 'openapi3-ts/oas32';
import type { Source } from '~/diagnostic';
import type { Components, Schema } from '~/schema/definition';
import type {
  Content,
  Header,
  HeaderRepresentation,
  MediaContent,
  Response,
  HeaderDefinitions,
} from '~/document/definition';
import { record, examples, extensions } from '~/document/metadata';
import { explicitSchema } from '~/schema/validation';
import { parameterStyle } from '~/document/parameter';
import { mediaType } from '~/document/media';
import uriResolver from 'fast-uri';

/** Parses Header Objects and references consistently at every HTTP use site. */
export function headerObjects(
  value: unknown,
  components: Components,
  source: Source,
  context = 'encoding',
): Record<string, Header | ReferenceObject> {
  const headers = record(value, source, `${context} headers`);
  const used = new Set<string>();
  return Object.fromEntries(
    Object.entries(headers).map(([name, entry]) => {
      if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(name) || used.has(name.toLowerCase()))
        return source.fail(`Invalid or duplicate ${context} header ${name}.`);
      used.add(name.toLowerCase());
      if (name.toLowerCase() === 'content-type')
        return source.fail(
          'Content-Type belongs in contentType or the media content map, not headers.',
        );
      const metadata = record(entry, source, `${context} header ${name}`);
      const ref = referenceObject(metadata, source, 'Header reference');
      if (ref) return [name, ref];
      if (Object.hasOwn(metadata, 'schema') === Object.hasOwn(metadata, 'content'))
        return source.fail(`${context} header ${name} requires exactly one of schema or content.`);
      let representation: HeaderRepresentation;
      let serialization = {};
      if (Object.hasOwn(metadata, 'content')) {
        if (['style', 'explode', 'example', 'examples'].some((key) => Object.hasOwn(metadata, key)))
          source.fail(
            'Header content cannot be combined with schema serialization or header-level examples.',
          );
        representation = { content: headerContent(metadata.content, components, source) };
      } else {
        const schema = explicitSchema(metadata.schema, components, source);
        serialization = parameterStyle(schema, 'header', components, source, metadata);
        representation = { schema };
      }
      return [
        name,
        {
          ...metadata,
          ...representation,
          required: Object.hasOwn(metadata, 'required') ? (metadata.required as boolean) : false,
          ...serialization,
          ...examples(metadata, source),
        },
      ];
    }),
  );
}

/** The single media representation allowed for a content-based Header Object. */
function headerContent(value: unknown, components: Components, source: Source): Content {
  const entries = Object.entries(record(value, source, 'Header content'));
  if (entries.length !== 1)
    return source.fail('Header content must contain exactly one media type.');
  const [name, value_] = entries[0]!;
  mediaType(name, source);
  const metadata = record(value_, source, 'Header media representation');
  const ref = referenceObject(metadata, source, 'Media type reference');
  if (ref) return { [name]: ref };
  for (const key of Object.keys(metadata))
    if (!['schema', 'example', 'examples'].includes(key) && !key.startsWith('x-'))
      source.fail(`Unsupported header media field ${key}.`);
  if (!Object.hasOwn(metadata, 'schema'))
    return source.fail('Header media representation requires a schema.');
  return {
    [name]: {
      schema: explicitSchema(metadata.schema, components, source),
      ...examples(metadata, source),
      ...extensions(metadata),
    },
  };
}

/** Reusable Header Object components and the schemas reachable through their references. */
export class HeaderRegistry {
  readonly headers: Record<string, Header | ReferenceObject> = Object.create(null) as Record<
    string,
    Header | ReferenceObject
  >;
  constructor(
    definitions: HeaderDefinitions,
    components: Components,
    private readonly source: Source,
  ) {
    for (const [name, value] of Object.entries(definitions)) {
      if (!/^[a-zA-Z0-9._-]+$/.test(name))
        source.fail(`Invalid Header Object component name ${name}.`);
      this.headers[name] = headerObjects(
        { Header: value },
        components,
        source,
        'component',
      ).Header!;
    }
    for (const header of Object.values(this.headers)) this.resolve(header, source);
  }

  payloads(): Schema[] {
    return Object.values(this.headers).flatMap((header) => this.schemas(header, this.source));
  }

  media(content: MediaContent | ReferenceObject, source: Source): Schema[] {
    if ('$ref' in content) return [];
    const roots = [content.schema, content.itemSchema].filter((schema) => schema !== undefined);
    for (const encoding of Object.values(content.encoding ?? {}))
      for (const header of Object.values(encoding.headers ?? {}))
        roots.push(...this.schemas(header, source));
    return roots;
  }

  response(response: Response, source: Source): Schema[] {
    return [
      ...Object.values(response.content ?? {}).flatMap((content) => this.media(content, source)),
      ...Object.values(response.headers ?? {}).flatMap((header) => this.schemas(header, source)),
    ];
  }

  private schemas(header: Header | ReferenceObject, source: Source): Schema[] {
    const value = this.resolve(header, source);
    if (!value) return [];
    return value.schema
      ? [value.schema]
      : Object.values(value.content ?? {}).flatMap((media) => this.media(media, source));
  }

  private resolve(
    header: Header | ReferenceObject,
    source: Source,
    active = new Set<string>(),
  ): Header | undefined {
    if (!('$ref' in header)) return header;
    const prefix = '#/components/headers/';
    if (!header.$ref.startsWith('#')) {
      if (/\s|%(?![0-9a-fA-F]{2})/.test(header.$ref) || uriResolver.parse(header.$ref).error)
        return source.fail('Invalid external Header Object reference URI.');
      return undefined;
    }
    if (!header.$ref.startsWith(prefix))
      return source.fail(
        'Local Header Object references must target #/components/headers/ entries.',
      );
    if (active.has(header.$ref) || active.size >= 100)
      return source.fail('Circular or excessive Header Object references.');
    let name: string;
    try {
      const path = parsePointer(header.$ref);
      if (path.length !== 3) return source.fail('Header Object references must target an entry.');
      name = path[2]!;
    } catch {
      return source.fail('Invalid Header Object reference encoding.');
    }
    if (!Object.hasOwn(this.headers, name))
      return source.fail(`Unresolved Header Object reference ${header.$ref}.`);
    return this.resolve(this.headers[name]!, source, new Set(active).add(header.$ref));
  }
}
