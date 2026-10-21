import type { OpenAPIObject } from 'openapi3-ts/oas32';
import type { OpenApiDocument } from '~/document/definition';
import { DocumentValidation } from '~/document/validation';
import { GenerationError } from '~/diagnostic';

export interface Modifier {
  modify(document: OpenAPIObject): void;
}
export type DocumentModifier = Modifier | ((document: OpenAPIObject) => void);

/** Modifiers receive an isolated document and commit only a validated synchronous result. */
export function modifyDocument(
  document: OpenApiDocument,
  modifiers: readonly DocumentModifier[] | undefined,
): OpenApiDocument {
  if (modifiers === undefined) return document;
  if (!Array.isArray(modifiers)) throw new GenerationError('modifiers must be an array.');
  if (modifiers.length === 0) return document;
  let modified: OpenApiDocument;
  try {
    modified = structuredClone(document);
  } catch (error) {
    throw new GenerationError(`Cannot copy document for modifiers: ${String(error)}`);
  }
  for (const [index, modifier] of modifiers.entries()) {
    try {
      const result: unknown =
        typeof modifier === 'function' ? modifier(modified) : modifier.modify(modified);
      if (
        result &&
        (typeof result === 'object' || typeof result === 'function') &&
        'then' in result &&
        typeof result.then === 'function'
      ) {
        void Promise.resolve(result).catch(() => {});
        throw new Error('Modifiers must be synchronous.');
      }
    } catch (error) {
      throw new GenerationError(
        `Document modifier ${index + 1} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  new DocumentValidation().validate(modified);
  return modified;
}
