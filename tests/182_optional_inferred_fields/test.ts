interface User {
  id: string;
  next?: User;
}
type Direct<T> = T extends `user_${infer Name}` ? { name?: Name; copy?: Name; owner?: User } : null;
type Nested<T> = T extends `user_${infer Name}` ? { value?: { name?: Name }; owner?: User } : null;
type Tuples<T> = T extends `user_${infer Name}`
  ? { pair?: readonly [name?: Name]; owner?: User }
  : null;

/** @schema */
export interface Model {
  /** @inline */
  direct: Direct<'user_ada' | 'user_bo' | 'none'>;
  /** @inline */
  nested: Nested<'user_cy' | 'none'>;
  /** @inline */
  tuples: Tuples<'user_di' | 'none'>;
}
