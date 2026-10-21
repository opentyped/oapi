type StringHead<T> = T extends [infer H extends string, ...unknown[]] ? H : 'fallback';
type ObjectValue<T> = T extends { value: infer V extends { id: string } } ? V : null;
type Project<T> = T extends { kind: infer K; value: infer V } ? { kind: K; value: V } : never;

/** @schema */
export interface Model {
  /** @inline */
  accepted: StringHead<['ok']>;
  /** @inline */
  rejected: StringHead<[42]>;
  /** @inline */
  distributed: StringHead<[42] | ['ok']>;
  /** @inline */
  object: ObjectValue<{ value: { id: string } } | { value: { id: number } }>;
  /** @inline */
  projected: Project<{ kind: 'a'; value: string } | { kind: 'b'; value: number }>;
}
