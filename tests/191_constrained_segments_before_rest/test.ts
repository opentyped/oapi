/** @maxItems 1 */
type Short = [count: number, enabled?: boolean];
/** @minItems 2 */
type Long = [count: number, enabled?: boolean];
/** @minItems 3 */
type Impossible = [number, boolean];

/** @schema */
export interface Model {
  short: [...Short, ...string[]];
  long: [...Long, ...string[]];
  impossible?: [...Impossible, ...string[]];
}
