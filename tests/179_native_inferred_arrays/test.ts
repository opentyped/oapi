interface User {
  id: string;
  next?: User;
}
type Lists<T> = T extends `user_${infer Name}`
  ? {
      /** @minItems 1 */
      names: ReadonlyArray<Array<Name>>;
      owner: User;
    }
  : null;
type Nested<T> = T extends `user_${infer Name}`
  ? {
      value: {
        /** @minLength 2 */
        name: Name;
        copy?: Name;
      };
      owner: User;
    }
  : null;

/** @schema */
export interface Model {
  /** @inline */
  lists: Lists<'user_ada' | 'none'>;
  /** @inline */
  nested: Nested<'user_bo' | 'none'>;
}
