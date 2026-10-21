/** @schema */
export interface Model {
  fixed: readonly [string, number, boolean?];
  rest: [string, ...number[]];
}
