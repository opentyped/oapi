interface User {
  id: string;
  next?: User;
}
type Select<T> = T extends `user_${infer Name}`
  ? { pair: readonly [name: Name, owner: User, copy?: Name] }
  : null;

/** @schema */
export interface Model {
  /** @inline */
  item: Select<'user_ada' | 'user_bo' | 'none'>;
}
