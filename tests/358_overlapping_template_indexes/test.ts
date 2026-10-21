interface Base {
  /** @minLength 2 */
  name: string;
  children: Base[];
}
interface Special extends Base {
  rank: number;
}

/** @schema */
export interface Dataset {
  label?: string;
  [key: `item_${string}`]: Base;
  [key: `item_special_${string}`]: Special;
}
