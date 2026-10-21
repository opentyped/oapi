type Selected<T> = T extends `user_${infer Name}`
  ? {
      /** @minLength 2 */
      name: NoInfer<Name>;
      values: NoInfer<ReadonlyArray<Name>>;
    }
  : never;
type Container<T> = { entry: NoInfer<Selected<T>> };

/** @schema */
export interface Model {
  /** @inline */
  value: Selected<'user_ada' | 'user_bo'>;
  /** @inline */
  nested: Container<'user_cy'>;
}
