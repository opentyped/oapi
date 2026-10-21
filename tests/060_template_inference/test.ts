type Suffix<T> = T extends `item_${infer Name}` ? Name : 'invalid';
type Numeric<T> = T extends `${infer Value extends number}` ? Value : null;

type Forward<T> = Suffix<T>;
type Again<T> = Forward<T>;

/** @schema */
export interface Model {
  /** @inline */
  forwarded: Again<'item_alpha'>;
  /** @inline */
  suffix: Suffix<'item_alpha'>;
  /** @inline */
  rejected: Suffix<'other'>;
  /** @inline */
  numeric: Numeric<'42'>;
  /** @inline */
  invalidNumeric: Numeric<'not-a-number'>;
  /** @inline */
  nonCanonicalNumeric: Numeric<'01'>;
  /** @inline */
  distributed: Suffix<'item_a' | 'item_b'>;
}
