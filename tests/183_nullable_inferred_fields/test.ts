interface User {
  id: string;
  next?: User;
}
type Nullable<T> = T extends `user_${infer Name}`
  ? {
      /** @minLength 2 */
      name: Name | null;
      names: Array<Name | null> | null;
      fallback?: Name | 'missing';
      owner: User;
    }
  : null;
type Choice<T> = T extends `user_${infer Name}` ? { value: Name | 'missing'; owner: User } : null;
type Items<T> = T extends `user_${infer Name}`
  ? { values: (Name | null)[] | null; owner: User }
  : null;

/** @schema */
export interface Model {
  /** @inline */
  nullable: Nullable<'user_ada' | 'user_bo' | 'none'>;
  /** @inline */
  choice: Choice<'user_di' | 'none'>;
  /** @inline */
  items: Items<'user_ev' | 'none'>;
}
