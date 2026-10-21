type Pattern<T extends string> = `item_${T}`;
type Aliased<T> = T extends Pattern<infer Name> ? Name : 'invalid';
type Many<T extends string> = `item_${T}` | `kind_${T}`;
type UnionAlias<T> = T extends Many<infer Name> ? Name : 'invalid';
// prettier-ignore
type Wrapped<T> = (T extends (`item_${infer Name}`) ? Name : 'invalid');

/** @schema */
export interface Model {
  /** @inline */
  wrapped: Wrapped<'item_alpha'>;
  /** @inline */
  aliased: Aliased<'item_beta'>;
  /** @inline */
  rejected: Aliased<'other'>;
  /** @inline */
  unionAliased: UnionAlias<'kind_gamma'>;
}
