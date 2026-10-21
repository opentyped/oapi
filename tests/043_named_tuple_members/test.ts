type Tail = boolean[];
type Pair = [count: number, enabled?: boolean];

/** @schema */
export interface Model {
  mixed: readonly [first: string, second?: number, ...tail: Tail];
  expanded: [first: string, ...pair: Pair];
}
