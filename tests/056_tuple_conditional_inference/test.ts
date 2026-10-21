type Head<T> = T extends readonly [infer H, ...unknown[]] ? H : never;
type Tail<T> = T extends readonly [unknown, ...infer R] ? R : never;
type Element<T> = T extends ReadonlyArray<infer V> ? V : never;
type Selected<T> = T extends { kind: 'user'; value: infer V } ? V : never;

/** @schema */
export interface Model {
  /** @inline */
  head: Head<readonly [string, number]>;
  /** @inline */
  tail: Tail<[string, number, boolean?]>;
  /** @inline */
  element: Element<readonly (string | number)[]>;
  /** @inline */
  selected: Selected<{ kind: 'user'; value: { id: string } } | { kind: 'skip' }>;
}
