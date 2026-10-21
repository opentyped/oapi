interface Alternating<T extends string | number> {
  /**
   * @minLength 1
   * @minimum 0
   */
  value: T;
  next?: Alternating<T extends string ? number : string>;
}
/** @schema */
export type Model = Alternating<string>;
