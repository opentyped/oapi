interface Brand {
  readonly __brand: unique symbol;
}
/** @minLength 3 */
type Identifier = string;
type UserId = Identifier & Brand;
type Sequence = number & { readonly __brand: unique symbol };

/** @schema */
export interface Model {
  id: UserId;
  sequence: Sequence;
  parent?: Model;
}
