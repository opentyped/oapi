import { SchemaResource } from '~/schema/resource';
import type { SchemaEntry } from '~/schema/resource';
import type { ServerObject } from 'openapi3-ts/oas32';
import { visitResolvedDocument, referenceSections, validationDocument } from '~/document/visitor';
import { validateJson } from '~/json';
import { DocumentReferences } from '~/document/reference';
import { DocumentRelationships } from '~/document/relationships';
import { record } from '~/document/metadata';
import { Security } from '~/document/security';
import { validate } from '@scalar/openapi-validator';
import type { OpenApiDocument, Tag } from '~/document/definition';
import { GenerationError } from '~/diagnostic';
import { explicitSchema, xmlAnnotations } from '~/schema/validation';
import { visitSchema } from '~/schema/visitor';

const source = {
  location: 'modified document',
  fail(message: string): never {
    throw new GenerationError(message);
  },
};

/** Validates modifier output with the specification schema and generator-specific invariants. */
export class DocumentValidation {
  private refs: DocumentReferences | undefined;
  private shapes: DocumentReferences | undefined;
  private readonly targets = new Map<string, Set<unknown>>();
  private relationships: DocumentRelationships | undefined;
  private security: Security | undefined;
  validate(document: OpenApiDocument): void {
    validateJson(document, 'OpenAPI document');
    this.targets.clear();
    const structural = validationDocument(document);
    const result = validate(structural);
    if (!result.valid)
      throw new GenerationError(
        `Invalid modified OpenAPI document: ${result.errors.map((error) => `${error.path}: ${error.message}`).join('; ')}`,
      );
    if (
      !['3.1.0', '3.2.0'].includes(document.openapi) ||
      !document.paths ||
      !document.components?.schemas
    )
      throw new GenerationError(
        'Documents require OpenAPI 3.1.0 or 3.2.0, paths, and components.schemas.',
      );
    this.refs = new DocumentReferences(document);
    this.shapes = new DocumentReferences(structural);
    this.relationships = new DocumentRelationships(document, this.refs);
    this.security = new Security(
      document.components.securitySchemes ?? {},
      source,
      document.openapi,
      (ref) => {
        this.reference(ref, 'securitySchemeObject', document.openapi);
        const target = this.refs!.resolve(ref);
        return target === undefined ? undefined : record(target, source, 'Security scheme URI');
      },
      document.$self,
    );
    if (document.security !== undefined) this.security.requirements(document.security);
    this.catalog(document);
    this.references(document);
    this.relationships.validate();
  }

  private catalog(document: OpenApiDocument): void {
    const tags = new Map<string, Tag>();
    for (const tag of document.tags ?? []) {
      if (!tag.name.trim() || tags.has(tag.name))
        source.fail(`Invalid or duplicate document tag ${tag.name}.`);
      tags.set(tag.name, tag);
    }
    const checked = new Set<string>();
    for (const tag of tags.values()) {
      let current = tag;
      const active = new Set<string>();
      while (!checked.has(current.name)) {
        if (active.has(current.name))
          source.fail(`Circular tag hierarchy: ${[...active, current.name].join(' -> ')}.`);
        active.add(current.name);
        if (current.parent === undefined) break;
        const parent = tags.get(current.parent);
        if (!parent)
          return source.fail(`Unknown parent tag ${current.parent} for ${current.name}.`);
        current = parent;
      }
      for (const name of active) checked.add(name);
    }
    const servers = [...(document.servers ?? [])];
    visitResolvedDocument(document, this.refs!, {
      object(object, role) {
        if ((role === 'operationObject' || role === 'pathItem') && Array.isArray(object.servers))
          servers.push(...(object.servers as ServerObject[]));
        if (role === 'linkObject' && object.server !== undefined)
          servers.push(object.server as ServerObject);
      },
    });
    for (const server of servers) {
      if (/[{}]/.test(server.url.replace(/\{([^{}]+)\}/g, '')))
        source.fail('Malformed server URL template.');
      const url = server.url.replace(/\{([^{}]+)\}/g, (_match, name: string) => {
        if (!Object.hasOwn(server.variables ?? {}, name))
          source.fail(`Missing server variable ${name}.`);
        return String(server.variables![name]!.default);
      });
      for (const [name, variable] of Object.entries(server.variables ?? {}))
        if (variable.enum && !variable.enum.some((value) => value === variable.default))
          source.fail(`Server variable ${name} enum must contain its default.`);
      if (!url.trim() || /\s/.test(url)) source.fail('Invalid server URI reference.');
      try {
        new URL(url, 'https://oapi.invalid');
      } catch {
        source.fail('Invalid server URI reference.');
      }
    }
  }

  private reference(ref: string, role: string, version: OpenApiDocument['openapi']): void {
    this.refs!.resolve(ref);
    const section = Object.hasOwn(referenceSections, role) ? referenceSections[role] : undefined;
    if (!section) return;
    const target = this.shapes!.resolve(ref);
    if (target === undefined) return;
    const checked = this.targets.get(section) ?? new Set<unknown>();
    if (checked.has(target)) return;
    const result = validate({
      openapi: version,
      info: { title: 'Reference target', version: '1' },
      paths: {},
      components: { [section]: { target } },
    });
    if (!result.valid)
      source.fail(
        `Invalid ${role} reference ${ref}: ${result.errors.map((error) => error.message).join('; ')}`,
      );
    checked.add(target);
    this.targets.set(section, checked);
  }

  private references(document: OpenApiDocument): void {
    const xml: unknown[] = [];
    const schemas: SchemaEntry[] = [];
    visitResolvedDocument(document, this.refs!, {
      object: (object, role) => {
        if (role === 'operationObject') {
          this.relationships!.operation(object);
          if (object.security !== undefined) this.security!.requirements(object.security);
        }
        if (role === 'externalDocs' && !String(object.url).trim())
          source.fail('externalDocs requires a nonempty URI reference.');
        if (role === 'pathItem') this.relationships!.pathItem(object);
        if (role === 'linkObject') this.relationships!.link(object);
        if (typeof object.$ref === 'string') this.reference(object.$ref, role, document.openapi);
      },
      schema: (value, owner, key, path) => {
        const schema = explicitSchema(value, document.components.schemas, source, 'document');
        schemas.push({ schema: typeof value === 'boolean' ? value : schema, path });
        owner[key] = schema;
        visitSchema(schema, (item) => {
          if (typeof item !== 'boolean' && item.xml !== undefined) xml.push(item.xml);
        });
      },
    });
    try {
      new SchemaResource(schemas, 'document', document.$self).validate();
    } catch (error) {
      source.fail(
        `Invalid schema resource graph: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    xmlAnnotations(xml, source);
  }
}
