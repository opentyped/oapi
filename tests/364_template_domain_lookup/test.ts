interface Base {
  /** @minLength 2 */
  name: string;
  children: Base[];
}
interface Special extends Base {
  rank: number;
}

type P = `item_${string}`;
type Q = `item_special_${string}`;
type Combined = Record<P, Base> & Record<Q, Special>;

/** @schema */
export interface Dataset {
  general: Combined[P];
  narrow: Combined[Q];
  all: Combined[keyof Combined];
}
