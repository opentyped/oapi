type Selected<T> = T extends `user_${infer Name}`
  ? {
      /** @minItems 1 */
      values: [...Name[]];
      prefixed: readonly ['start', ...names: Name[]];
      native: ['start', ...ReadonlyArray<Name>];
    }
  : never;

/** @schema */
export interface Model {
  /** @inline */
  value: Selected<'user_ada' | 'user_bo'>;
}
