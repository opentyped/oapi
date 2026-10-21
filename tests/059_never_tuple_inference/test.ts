type Wrapped<T> = [T] extends [infer V extends string] ? V : null;
type Nested<T> = [T] extends [[infer V extends string]] ? V : null;
type Repeated<T> = [T] extends [[infer V, infer V]] ? V : null;

/** @schema */
export interface Model {
  /** @inline */
  accepted: Wrapped<'ok'>;
  /** @inline */
  rejected: Wrapped<42>;
  optionalNever?: Wrapped<never>;
  nestedNever?: Nested<[never]>;
  /** @inline */
  repeated: Repeated<[never, 'kept']>;
  label: string;
}
