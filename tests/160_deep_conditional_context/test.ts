interface User {
  /** @minLength 2 */
  name: string;
  manager?: User;
}
interface Missing {
  code: 'missing';
}
type Suffix<T> = T extends `item_${infer Name}` ? Name : 'invalid';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- The pattern selects the output model.
type Selected<T> = T extends `item_${infer Name}` ? User : Missing;
interface Cell<T> {
  nested: { payload: { name: Suffix<T>; model: Selected<T> } };
}
/** @minProperties 1 */
interface Envelope<T> {
  value: Cell<T>;
}
type Forward<T> = Envelope<T>;
/** @schema */
export type Result = Forward<'item_ada'>;

type Numeric<T> = T extends `${infer Value extends number}` ? Value : null;
interface OptionalCell<T> {
  nested?: { payload?: { numeric?: Numeric<T>; name?: Suffix<T>; model?: Selected<T> } };
}
interface OptionalEnvelope<T> {
  value?: OptionalCell<T>;
}
/** @schema */
export type OptionalResult = OptionalEnvelope<'item_optional'>;
