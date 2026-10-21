import { parsePointer, formatPointer } from '~/pointer';
import { DEFAULT_OPENAPI } from '~/document/definition';
import uriResolver from 'fast-uri';
import { DocumentReferences } from '~/document/reference';
import type { Source } from '~/diagnostic';
import type { SecuritySchemes, OpenApiDocument } from '~/document/definition';
import { record } from '~/document/metadata';

/** Owns security scheme resolution and requirement checks for document and operation scope. */
export class Security {
  private readonly refs: DocumentReferences;
  constructor(
    private readonly schemes: SecuritySchemes,
    private readonly source: Source,
    private readonly version: OpenApiDocument['openapi'] = DEFAULT_OPENAPI,
    private readonly resolveUri?: (ref: string) => Record<string, unknown> | undefined,
    self?: string,
  ) {
    record(schemes, source, 'Security schemes');
    this.refs = new DocumentReferences({
      components: { securitySchemes: schemes },
      ...(self !== undefined ? { $self: self } : {}),
    });
    for (const name of Object.keys(schemes)) {
      if (!/^[a-zA-Z0-9._-]+$/.test(name)) source.fail(`Invalid security scheme name ${name}.`);
      this.validate(name);
    }
  }

  requirements(value: unknown, source = this.source): Record<string, string[]>[] {
    if (!Array.isArray(value))
      return source.fail('Invalid security requirements: expected an array.');
    for (const item of value) {
      const requirement = record(item, source, 'Security requirement');
      for (const [name, scopes] of Object.entries(requirement)) {
        if (!Array.isArray(scopes) || !scopes.every((scope) => typeof scope === 'string'))
          source.fail('Security requirements must contain arrays of strings.');
        const named = Object.hasOwn(this.schemes, name);
        if (!named && this.version !== '3.2.0') source.fail(`Unknown security scheme ${name}.`);
        const scheme = named ? this.resolve(name) : this.uri(name, source);
        if (!scheme || scheme.type !== 'oauth2') continue;
        const available = new Set(
          Object.entries(record(scheme.flows, source, 'OAuth flows'))
            .filter(([name]) => !name.startsWith('x-'))
            .flatMap(([, flow]) =>
              Object.keys(
                record(record(flow, source, 'OAuth flow').scopes, source, 'OAuth scopes'),
              ),
            ),
        );
        for (const scope of scopes as string[])
          if (!available.has(scope)) source.fail(`Unknown OAuth scope ${scope} for ${name}.`);
      }
    }
    return value as Record<string, string[]>[];
  }

  private uri(name: string, source: Source): Record<string, unknown> | undefined {
    if (
      !name ||
      /\s|%(?![0-9a-fA-F]{2})/.test(name) ||
      [...name].some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ) ||
      uriResolver.parse(name).error
    )
      return source.fail(`Invalid security scheme URI ${name}.`);
    let ref = name;
    if (name.startsWith('#')) {
      let path: string[];
      try {
        path = parsePointer(name);
      } catch {
        return source.fail('Local security scheme URIs require a JSON Pointer fragment.');
      }
      if (!path.length)
        return source.fail('Local security scheme URIs require a JSON Pointer fragment.');
      ref = formatPointer(path, true);
    }
    // Local URI targets are checked after every parser has contributed to the document.
    const scheme = this.resolveUri?.(ref);
    if (scheme) this.validate(name, scheme);
    return scheme;
  }

  private resolve(name: string): Record<string, unknown> | undefined {
    try {
      const scheme = this.refs.resolve(
        formatPointer(['components', 'securitySchemes', name], true),
      );
      return scheme === undefined
        ? undefined
        : record(scheme, this.source, `Security scheme ${name}`);
    } catch (error) {
      return this.source.fail(error instanceof Error ? error.message : String(error));
    }
  }

  private validate(name: string, scheme = this.resolve(name)): void {
    if (!scheme) return;
    // Specification shapes are validated by Scalar; these constraints are semantic.
    if (scheme.type === 'apiKey') {
      const keyName = this.string(scheme.name, 'API key name');
      if (
        ['header', 'cookie'].includes(String(scheme.in)) &&
        !/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(keyName)
      )
        this.source.fail('Invalid API key header or cookie name.');
    } else if (scheme.type === 'http') {
      if (
        !/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(
          this.string(scheme.scheme, 'HTTP authentication scheme'),
        )
      )
        this.source.fail('Invalid HTTP authentication scheme.');
      if (scheme.bearerFormat !== undefined) this.string(scheme.bearerFormat, 'bearerFormat');
    } else if (scheme.type === 'openIdConnect')
      this.string(scheme.openIdConnectUrl, 'OpenID Connect URL');
    else if (scheme.type === 'oauth2') {
      if (scheme.oauth2MetadataUrl !== undefined)
        this.string(scheme.oauth2MetadataUrl, 'OAuth metadata URL');
      for (const [name, value] of Object.entries(
        record(scheme.flows, this.source, 'OAuth flows'),
      )) {
        if (name.startsWith('x-')) continue;
        const flow = record(value, this.source, `OAuth flow ${name}`);
        for (const field of [
          'authorizationUrl',
          'deviceAuthorizationUrl',
          'tokenUrl',
          'refreshUrl',
        ])
          if (flow[field] !== undefined) this.string(flow[field], `${name} ${field}`);
      }
    }
  }

  private string(value: unknown, context: string): string {
    if (typeof value !== 'string' || !value.trim())
      return this.source.fail(`${context} requires a nonempty string.`);
    return value;
  }
}
