import { validate } from '@scalar/openapi-validator';
import type { OpenApiDocument } from '~/document/definition';
import type { DocumentReferences } from '~/document/reference';
import { GenerationError } from '~/diagnostic';
import { operationsOf, validationDocument } from '~/document/visitor';

type ObjectValue = Record<string, unknown>;

/** Semantic relationships that the OpenAPI structural schema cannot express. */
export class DocumentRelationships {
  private readonly ids = new Set<string>();
  private readonly operations = new WeakSet<object>();
  private readonly links: ObjectValue[] = [];
  constructor(
    private readonly document: OpenApiDocument,
    private readonly refs: DocumentReferences,
  ) {}

  operation(operation: ObjectValue): void {
    this.operations.add(operation);
    const id = operation.operationId;
    if (typeof id !== 'string' || !id.trim())
      throw new GenerationError('Modified operations require an operationId.');
    if (this.ids.has(id))
      throw new GenerationError(`Duplicate operationId ${id} after document generation.`);
    this.ids.add(id);
    this.parameters('Operation', undefined, undefined, operation.parameters);
  }

  link(link: ObjectValue): void {
    this.links.push(link);
  }

  validate(): void {
    const paths = new Map<string, string>();
    for (const [path, raw] of Object.entries(this.document.paths)) {
      if (path.startsWith('x-')) continue;
      const shape = path.replace(/\{[^}]+\}/g, '{}');
      if (paths.has(shape) && paths.get(shape) !== path)
        throw new GenerationError(
          `Equivalent templated paths ${paths.get(shape)} and ${path} after document generation.`,
        );
      paths.set(shape, path);
      const item = this.object(raw);
      if (!item) continue;
      const names = [...path.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]!);
      if (/[{}]/.test(path.replace(/\{[^{}]+\}/g, '')) || new Set(names).size !== names.length)
        throw new GenerationError(`Invalid path template ${path}.`);
      for (const value of operationsOf(item)) {
        const operation = this.object(value);
        if (operation) this.parameters(path, names, item.parameters, operation.parameters);
      }
    }
    for (const link of this.links) {
      if (typeof link.operationId === 'string' && !this.ids.has(link.operationId))
        throw new GenerationError(
          `Unknown link operationId ${link.operationId} after document generation.`,
        );
      if (
        typeof link.operationRef === 'string' &&
        this.refs.pointer(link.operationRef) !== undefined
      ) {
        const operation = this.object(this.refs.resolve(link.operationRef));
        let path = '/.typedapi-link-target';
        while (Object.hasOwn(this.document.paths, path)) path += '_';
        if (
          !operation ||
          (!this.operations.has(operation) &&
            !validate(
              validationDocument({
                ...this.document,
                paths: { ...this.document.paths, [path]: { get: operation } },
              }),
            ).valid)
        )
          throw new GenerationError(
            `Link operationRef ${link.operationRef} does not target an operation.`,
          );
      }
    }
  }

  pathItem(raw: ObjectValue): void {
    const item = this.object(raw);
    if (!item) return;
    this.parameters('Path Item', undefined, item.parameters, undefined);
    for (const value of operationsOf(item)) {
      const operation = this.object(value);
      if (!operation) continue;
      this.parameters('Path Item', undefined, item.parameters, operation.parameters);
    }
  }

  private object(value: unknown): ObjectValue | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const object = value as ObjectValue;
    if (typeof object.$ref === 'string') return this.object(this.refs.resolve(object.$ref));
    return object;
  }

  private parameters(
    path: string,
    names: string[] | undefined,
    inherited: unknown,
    local: unknown,
  ): void {
    const combined = new Map<string, ObjectValue>();
    let external = false;
    for (const group of [inherited, local]) {
      if (!Array.isArray(group)) continue;
      const seen = new Set<string>();
      for (const raw of group) {
        const parameter = this.object(raw);
        if (!parameter) {
          external = true;
          continue;
        }
        const name = String(parameter.name);
        const identity = `${String(parameter.in)}:${parameter.in === 'header' ? name.toLowerCase() : name}`;
        if (seen.has(identity))
          throw new GenerationError(`Duplicate parameter ${name} after document generation.`);
        seen.add(identity);
        combined.set(identity, parameter);
      }
    }
    const whole = [...combined.values()].filter((parameter) => parameter.in === 'querystring');
    if (whole.length > 1)
      throw new GenerationError(`Only one querystring parameter is allowed for ${path}.`);
    if (whole.length && [...combined.values()].some((parameter) => parameter.in === 'query'))
      throw new GenerationError(`query and querystring parameters cannot be combined for ${path}.`);
    for (const parameter of combined.values()) {
      if (parameter.in !== 'path') continue;
      if (
        parameter.required !== true ||
        (names !== undefined && !names.includes(String(parameter.name)))
      )
        throw new GenerationError(
          `Path parameter ${String(parameter.name)} must be required and occur in ${path}.`,
        );
    }
    if (!external && names)
      for (const name of names)
        if (!combined.has(`path:${name}`))
          throw new GenerationError(
            `Missing path parameter ${name} for ${path} after document generation.`,
          );
  }
}
