/** RFC 6901 token escaping, independent of URI fragment encoding. */
export function escapePointer(value: string | number): string {
  return String(value).replaceAll('~', '~0').replaceAll('/', '~1');
}

export function unescapePointer(value: string): string {
  if (/~(?![01])/.test(value)) throw new SyntaxError(`Invalid JSON Pointer token ${value}.`);
  return value.replaceAll('~1', '/').replaceAll('~0', '~');
}

/** Parse a JSON Pointer or percent-encoded URI fragment, never a URI or anchor. */
export function parsePointer(value: string): string[] {
  const pointer = value.startsWith('#') ? decodeURIComponent(value.slice(1)) : value;
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) throw new SyntaxError(`Invalid JSON Pointer ${value}.`);
  return pointer.slice(1).split('/').map(unescapePointer);
}

export function tryParsePointer(value: string): string[] | undefined {
  try {
    return parsePointer(value);
  } catch {
    return undefined;
  }
}

export function formatPointer(tokens: readonly (string | number)[], fragment = false): string {
  return (
    (fragment ? '#' : '') +
    tokens
      .map((token) => {
        const escaped = escapePointer(token);
        return '/' + (fragment ? encodeURIComponent(escaped) : escaped);
      })
      .join('')
  );
}

export type PointerTarget = { found: true; value: unknown } | { found: false };

/** Traverse only own JSON properties; distinguish missing entries from undefined values. */
export function walkPointer(value: unknown, tokens: readonly string[]): PointerTarget {
  for (const token of tokens) {
    if (!value || typeof value !== 'object') return { found: false };
    if (
      Array.isArray(value) &&
      (!/^(0|[1-9][0-9]*)$/.test(token) ||
        !Number.isSafeInteger(Number(token)) ||
        Number(token) >= value.length)
    )
      return { found: false };
    if (!Object.hasOwn(value, token)) return { found: false };
    value = (value as Record<string, unknown>)[token];
  }
  return { found: true, value };
}

export type ReferenceStep<T> =
  { kind: 'terminal'; value: T } | { kind: 'missing' } | { kind: 'next'; reference: string };
export type ReferenceTarget<T> =
  Exclude<ReferenceStep<T>, { kind: 'next' }> | { kind: 'cycle' | 'depth'; reference: string };

/** Follow aliases without prescribing reference syntax, target lookup, or failure policy. */
export function walkReferenceChain<T>(
  reference: string,
  step: (reference: string) => ReferenceStep<T>,
  active: ReadonlySet<string> = new Set(),
  limit = Infinity,
): ReferenceTarget<T> {
  const seen = new Set(active);
  for (;;) {
    if (seen.has(reference)) return { kind: 'cycle', reference };
    if (seen.size >= limit) return { kind: 'depth', reference };
    const result = step(reference);
    if (result.kind !== 'next') return result;
    seen.add(reference);
    reference = result.reference;
  }
}
