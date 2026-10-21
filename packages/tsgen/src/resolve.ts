import { walkPointer, walkReferenceChain } from '@typedapi/openapi/pointer';
import { parseRef } from '~/pointer';

/** Depth-first walk over every plain object in a JSON-shaped value. */
export function walk(
  value: unknown,
  visit: (node: Record<string, unknown>, path: (string | number)[]) => void,
  path: (string | number)[] = [],
): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      walk(value[index], visit, [...path, index]);
    }
    return;
  }
  const record = value as Record<string, unknown>;
  visit(record, path);
  for (const key of Object.keys(record)) {
    walk(record[key], visit, [...path, key]);
  }
}

/**
 * Resolve a local `#/`-reference, transparently following reference chains.
 * Unresolvable, external, or circular references yield `undefined`.
 */
export function resolveRef<T>(
  document: unknown,
  ref: string,
  visited: string[] = [],
): T | undefined {
  // The initial reference is resolved even when supplied in the caller's visited list.
  const active = new Set(visited);
  active.delete(ref);
  const result = walkReferenceChain<unknown>(
    ref,
    (reference) => {
      const { pointer } = parseRef(reference);
      if (!pointer.length) return { kind: 'missing' };
      const target = walkPointer(document, pointer);
      if (!target.found) return { kind: 'missing' };
      const node = target.value;
      if (node && typeof node === 'object' && '$ref' in node)
        return { kind: 'next', reference: (node as { $ref: string }).$ref };
      return { kind: 'terminal', value: node };
    },
    active,
  );
  return result.kind === 'terminal' ? (result.value as T) : undefined;
}

/**
 * Object.entries with the generator's ordering applied: alphabetical when the
 * context requests it, document order otherwise.
 */
export function getEntries<T>(
  record: Record<string, T> | undefined,
  ctx: { alphabetize: boolean },
): [string, T][] {
  const entries = Object.entries(record ?? {});
  if (ctx.alphabetize) {
    entries.sort(([a], [b]) => a.localeCompare(b, 'en-us', { numeric: true }));
  }
  return entries;
}
