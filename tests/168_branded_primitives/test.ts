/** @minLength 3 */
type Identifier = string;
type UserId = Identifier & { readonly __brand: 'UserId' };
type Count = number & { readonly __brand: 'Count' };
type Enabled = true & { readonly __brand: 'Enabled' };

/** @schema */
export interface Model {
  id: UserId;
  count: Count;
  enabled: Enabled;
  parent?: Model;
}
