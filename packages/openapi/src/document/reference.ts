import { parsePointer, walkPointer, walkReferenceChain } from '~/pointer';
import uriResolver from 'fast-uri';
import type { ReferenceObject } from 'openapi3-ts/oas32';
import type { Source } from '~/diagnostic';
import { GenerationError } from '~/diagnostic';

/** Shared Reference Object syntax for configuration and generated HTTP metadata. */
export function referenceObject(
  value: Record<string, unknown>,
  source: Source,
  context: string,
): ReferenceObject | undefined {
  if (!('$ref' in value)) return undefined;
  if (typeof value.$ref !== 'string' || !value.$ref.trim())
    source.fail(`${context} requires a nonempty $ref.`);
  for (const [key, field] of Object.entries(value)) {
    if (!['$ref', 'summary', 'description'].includes(key))
      source.fail(`Unsupported ${context.toLowerCase()} field ${key}.`);
    if (typeof field !== 'string') source.fail(`${context} ${key} must be a string.`);
  }
  return value as unknown as ReferenceObject;
}

/** Decodes same-document URI fragments before applying JSON Pointer token escapes. */
export function documentPointer(ref: string, self?: string): string[] | undefined {
  if (ref !== '' && !ref.startsWith('#')) {
    if (self === undefined) return undefined;
    const identity = uriResolver.parse(self);
    if (!identity.scheme && !identity.path?.startsWith('/')) {
      if (uriResolver.parse(ref).scheme) return undefined;
      throw new GenerationError(
        'Non-fragment references with a relative $self require an absolute document URI.',
      );
    }
    const target = uriResolver.parse(uriResolver.resolve(self, ref));
    const fragment = target.fragment ?? '';
    delete identity.fragment;
    delete target.fragment;
    if (
      uriResolver.normalize(uriResolver.serialize(identity)) !==
      uriResolver.normalize(uriResolver.serialize(target))
    )
      return undefined;
    ref = '#' + fragment;
  }
  try {
    return parsePointer(ref);
  } catch {
    throw new GenerationError(`Invalid document reference ${ref}.`);
  }
}

/** Resolves document-level aliases without fetching external documents or expanding schema graphs. */
export class DocumentReferences {
  private readonly self: string | undefined;
  constructor(private readonly document: object) {
    const self = '$self' in document ? document.$self : undefined;
    if (
      self !== undefined &&
      (typeof self !== 'string' ||
        /\s|%(?![0-9a-f]{2})/i.test(self) ||
        [...self].some(
          (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        ) ||
        uriResolver.parse(self).error)
    )
      throw new GenerationError('Document $self must be a valid URI reference.');
    this.self = self;
  }

  pointer(ref: string): string[] | undefined {
    return documentPointer(ref, this.self);
  }
  resolve(
    ref: string,
    onTarget?: (target: Record<string, unknown>, path: readonly string[]) => void,
    active = new Set<string>(),
  ): unknown {
    let parts = this.pointer(ref);
    if (parts === undefined) return undefined;
    const result = walkReferenceChain<unknown>(
      ref,
      (reference) => {
        const resolved = walkPointer(this.document, parts!);
        if (!resolved.found)
          throw new GenerationError(`Unresolved document reference ${reference}.`);
        const target = resolved.value;
        if (target && typeof target === 'object' && !Array.isArray(target)) {
          onTarget?.(target as Record<string, unknown>, parts!);
          if ('$ref' in target && typeof target.$ref === 'string') {
            const next = target.$ref;
            parts = this.pointer(next);
            return parts === undefined
              ? { kind: 'terminal', value: undefined }
              : { kind: 'next', reference: next };
          }
        }
        return { kind: 'terminal', value: target };
      },
      active,
      100,
    );
    if (result.kind === 'cycle' || result.kind === 'depth')
      throw new GenerationError('Circular OpenAPI reference aliases after modifiers.');
    return result.kind === 'terminal' ? result.value : undefined;
  }
}
