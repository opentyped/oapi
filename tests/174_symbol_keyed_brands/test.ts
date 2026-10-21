declare const brand: unique symbol;
interface UserBrand {
  readonly [brand]: 'UserId';
}
/** @minLength 3 */
type Identifier = string;
type UserId = Identifier & UserBrand;
type Sequence = number & { readonly [brand]: 'Sequence' };

/** @schema */
export interface Model {
  id: UserId;
  sequence: Sequence;
  parent?: Model;
}
