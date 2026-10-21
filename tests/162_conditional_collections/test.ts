interface User {
  /** @minLength 2 */
  name: string;
  manager?: User;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Matching selects a model; the inferred suffix is deliberately unused.
type Select<T> = T extends `user_${infer Name}` ? User[] : null;
/** @schema */
export type Selected = Select<'user_ada'>;
/** @schema */
export type Rejected = Select<'other'>;
/** @schema */
export type Either = Select<'user_ada' | 'other'>;
