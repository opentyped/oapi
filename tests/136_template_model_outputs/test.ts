interface User {
  /** @minLength 2 */
  name: string;
  manager?: User;
}
interface Missing {
  /** @const rejected */
  code: string;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Matching selects a model; the inferred suffix is deliberately unused.
type Select<T> = T extends `user_${infer Name}` ? User : Missing;
/** @schema */
export type Selected = Select<'user_ada'>;
/** @schema */
export type Rejected = Select<'other'>;
/** @schema */
export type Either = Select<'user_ada' | 'other'>;

/** @minProperties 1 */
interface Box<T> {
  value: T;
  next?: Box<T>;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Matching selects a concrete generic model.
type BoxSelect<T> = T extends `user_${infer Name}` ? Box<User> : Missing;
/** @schema */
export type SelectedBox = BoxSelect<'user_ada'>;

type Forward<T> = BoxSelect<T>;
type Again<T> = Forward<T>;
/** @schema */
export type ForwardedBox = Again<'user_ada'>;
