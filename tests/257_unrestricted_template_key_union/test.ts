type Key = string | `item-${string}`;

/** @schema */
export type Model = Record<Key, string> & { kind: 'dictionary' };
