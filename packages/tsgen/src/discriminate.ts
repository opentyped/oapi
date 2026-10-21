import ts from 'typescript';
import { createRef, parseRef } from '~/pointer';
import { resolveRef, walk } from '~/resolve';
import { literalType, modifiers, propertyIndex } from '~/ast';
import type { Document, DiscriminatorObject, ReferenceObject, SchemaObject } from '~/types';

/** Discriminators found in a document plus the schema references already patched. */
export interface DiscriminatorIndex {
  objects: Record<string, DiscriminatorObject>;
  refsHandled: string[];
}

/** Discriminator property synthesized onto composed variants. */
export function discriminatorProperty(
  discriminator: DiscriminatorObject,
  path: string,
  readonly: boolean,
): ts.TypeElement {
  // The spec suggests inferring the value from the schema name at the ref tail.
  let value = parseRef(path).pointer.pop();
  if (discriminator.mapping) {
    // A mapping value is either a full reference or a bare schema name.
    const matched = Object.entries(discriminator.mapping).find(
      ([, target]) =>
        (!target.startsWith('#') && target === value) ||
        (target.startsWith('#') && parseRef(target).pointer.pop() === value),
    );
    if (matched) value = matched[0];
  }
  return ts.factory.createPropertySignature(
    modifiers({ readonly }),
    propertyIndex(discriminator.propertyName),
    /* questionToken */ undefined,
    literalType(value),
  );
}

function discriminatorEnum(values: string[], previous?: SchemaObject): SchemaObject {
  return {
    type: 'string',
    enum: values,
    description: previous?.description
      ? `${previous.description} (enum property replaced by openapi-typescript)`
      : 'discriminator enum property added by openapi-typescript',
  };
}

/** Patch the schema at `ref` so its discriminator property carries `values`. */
function patchDiscriminatorEnum(
  document: Document,
  ref: string,
  values: string[],
  discriminator: DiscriminatorObject,
): boolean {
  const resolved = resolveRef<SchemaObject>(document, ref);
  if (resolved && typeof resolved === 'object' && Array.isArray(resolved.allOf)) {
    resolved.allOf.push({
      type: 'object',
      required: [discriminator.propertyName],
      properties: { [discriminator.propertyName]: discriminatorEnum(values) },
    });
    return true;
  }
  if (resolved && typeof resolved === 'object' && resolved.type === 'object') {
    resolved.properties ??= {};
    if (!resolved.required) resolved.required = [discriminator.propertyName];
    else if (!resolved.required.includes(discriminator.propertyName)) {
      resolved.required.push(discriminator.propertyName);
    }
    resolved.properties[discriminator.propertyName] = discriminatorEnum(
      values,
      resolved.properties[discriminator.propertyName] as SchemaObject,
    );
    return true;
  }
  return false;
}

/**
 * Find every discriminator in the document and eagerly patch mapped schemas so
 * TypeScript narrows unions on the discriminator property. Runs in two passes:
 * declared mappings first, then implicit `allOf` inheritance.
 */
export function scanDiscriminators(document: Document): DiscriminatorIndex {
  const objects: Record<string, DiscriminatorObject> = {};
  const refsHandled: string[] = [];

  interface MappingValues {
    inferred?: string;
    defined?: string[];
  }
  const mappingFor = (oneOf: unknown): Record<string, MappingValues> => {
    const mapping: Record<string, MappingValues> = {};
    for (const item of oneOf as (SchemaObject | ReferenceObject)[]) {
      if (item && typeof item === 'object' && '$ref' in item) {
        const inferred = item.$ref.split('/').pop();
        if (inferred) (mapping[item.$ref] ??= {}).inferred = inferred;
      }
    }
    return mapping;
  };

  walk(document, (node, path) => {
    const discriminator = node.discriminator as DiscriminatorObject | undefined;
    if (!discriminator?.propertyName) return;
    const ref = createRef(path);
    objects[ref] = discriminator;

    if (!node.oneOf || !Array.isArray(node.oneOf)) return;
    const mapping = mappingFor(node.oneOf);

    if (discriminator.mapping) {
      for (const value in discriminator.mapping) {
        const target = discriminator.mapping[value];
        if (!target) continue;
        (mapping[target] ??= {}).defined ??= [];
        mapping[target].defined!.push(value);
      }
    }

    for (const [target, { inferred, defined }] of Object.entries(mapping)) {
      if (refsHandled.includes(target) || (!inferred && !defined)) continue;
      if (patchDiscriminatorEnum(document, target, defined ?? [inferred!], discriminator)) {
        refsHandled.push(target);
      }
    }
  });

  walk(document, (node, path) => {
    const allOf = node.allOf;
    if (!Array.isArray(allOf)) return;
    for (const item of allOf as (SchemaObject | ReferenceObject)[]) {
      if (item && typeof item === 'object' && '$ref' in item) {
        const inherited = inheritDiscriminator(document, objects, refsHandled, item.$ref, path);
        if (!inherited) return;
        objects[createRef(path)] = inherited;
      } else if (
        item &&
        typeof item === 'object' &&
        (item as SchemaObject).discriminator?.propertyName
      ) {
        objects[createRef(path)] = { ...(item as SchemaObject).discriminator! };
      }
    }
  });

  return { objects, refsHandled };
}

/**
 * Inherit the parent's discriminator through an `allOf` reference, patching
 * this schema's discriminator enum when the parent maps it. Returns the
 * inherited discriminator, or `undefined` when the parent carries none.
 */
function inheritDiscriminator(
  document: Document,
  objects: Record<string, DiscriminatorObject>,
  refsHandled: string[],
  parentRef: string,
  path: (string | number)[],
): DiscriminatorObject | undefined {
  const discriminator = objects[parentRef];
  if (!discriminator) return undefined;
  const ref = createRef(path);
  const mapping = discriminator.mapping;
  if (mapping) {
    const mappedValues = Object.keys(mapping).filter((value) => mapping[value] === ref);
    if (mappedValues.length && patchDiscriminatorEnum(document, ref, mappedValues, discriminator)) {
      refsHandled.push(ref);
    }
  }
  return { ...discriminator };
}
