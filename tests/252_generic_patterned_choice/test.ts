type Key = `item-${string}`;
type Choice<T> = (T & { kind: 'dictionary' }) | { fallback: true };

/** @schema */
export type Model = Choice<Record<Key, string>>;
