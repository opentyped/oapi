type StringTail<T> = T extends [unknown, ...infer R extends string[]] ? R : null;
type NamedTail<T> = T extends [first: unknown, ...tail: infer R extends string[]] ? R : null;

/** @schema */
export interface Model {
  /** @inline */
  empty: StringTail<[number]>;
  /** @inline */
  accepted: StringTail<[number, 'a', 'b']>;
  /** @inline */
  rejected: StringTail<[number, boolean]>;
  /** @inline */
  named: NamedTail<[number, string]>;
  /** @inline */
  distributed: StringTail<[number, boolean] | [number, string]>;
}
