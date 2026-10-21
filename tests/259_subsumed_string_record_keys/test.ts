type Key = 'fixed' | `item-${string}` | string;

/** @schema */
export type Model = Record<Key, string> & { kind: 'dictionary' };
