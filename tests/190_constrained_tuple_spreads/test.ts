/**
 * @minItems 2
 * @maxItems 3
 */
type Numbers = number[];
/** @maxItems 1 */
type Pair = [count: number, enabled?: boolean];
/** @minItems 3 */
type Impossible = [number, boolean];
type Forward<T extends unknown[]> = ['start', ...T];

/** @schema */
export interface Model {
  alternatives: ['start', ...(Numbers | [flag: boolean])];
  forwarded: Forward<Numbers>;
  shortened: ['start', ...Pair];
  impossible?: ['start', ...Impossible];
}
