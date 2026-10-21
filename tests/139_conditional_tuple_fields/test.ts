interface User {
  /** @minLength 2 */
  name: string;
  manager?: User;
}
interface Missing {
  code: 'missing';
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Matching selects the model.
type Selected<T> = T extends `item_${infer Name}` ? User : Missing;
type Suffix<T> = T extends `item_${infer Name}` ? Name : 'invalid';
type Row<T> = readonly [user: Selected<T>, suffix?: Suffix<T>];
type Matrix<T> = [row: Row<T>, copy?: Row<T>];
/** @schema */
export type Result = Row<'item_ada'>;
/** @schema */
export type Nested = Matrix<'item_matrix'>;

type WithRest<T> = [head: Selected<T>, ...tail: string[]];
/** @schema */
export type Prefix = WithRest<'item_prefix'>;

type BareRow<T> = [Selected<T>, Suffix<T>?];
type FrozenRow<T> = Readonly<BareRow<T>>;
/** @schema */
export type FrozenResult = FrozenRow<'item_frozen'>;
