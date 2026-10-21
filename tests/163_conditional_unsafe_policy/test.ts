// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Matching selects a model; the inferred suffix is deliberately unused.
type Select<T> = T extends `user_${infer Name}` ? unknown : null;
/** @schema */
export type Selected = Select<'user_ada'>;
/** @schema */
export type Rejected = Select<'other'>;
/** @schema */
export type Either = Select<'user_ada' | 'other'>;

/** @schema */
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any -- Explicit any is permitted only by this fixture's policy.
export type AllowedAny = 'user_ada' extends `user_${infer Name}` ? any : null;
