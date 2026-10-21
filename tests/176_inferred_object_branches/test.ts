interface User {
  id: string;
  next?: User;
}
type Select<T> = T extends `user_${infer Name}`
  ? {
      /** @minLength 2 */
      name: Name;
      copy?: Name;
      owner: User;
    }
  : null;

/** @schema */
export interface Model {
  item: Select<'user_ada' | 'user_bo' | 'user_x' | 'none'>;
}
