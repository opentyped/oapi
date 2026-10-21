export declare const brand: unique symbol;
type Brand<T, Name> = T & { readonly __brand: Name };
type Forward<T> = Brand<T, typeof brand>;
/** @minLength 3 */
type Identifier = string;

/** @schema */
export interface Model {
  /** @inline */
  id: Forward<Identifier>;
  /** @inline */
  maybe: Forward<Identifier> | null;
  next?: Model;
}
