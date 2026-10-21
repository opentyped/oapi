/** @maxLength 10 */
type TrimLeft<T extends string> = T extends ` ${infer Rest}` ? TrimLeft<Rest> : T;

type Forward<T extends string> = TrimLeft<T>;

/** @schema */
export interface Model {
  /** @inline */
  forwarded: Forward<'   hello'>;
  /** @inline */
  trimmed: TrimLeft<'   hello'>;
  /** @inline */
  unchanged: TrimLeft<'hello'>;
  /** @inline */
  empty: TrimLeft<'   '>;
  /** @inline */
  distributed: TrimLeft<' a' | 'b'>;
}
