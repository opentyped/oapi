interface Base {
  /** @minLength 2 */
  name: string;
  children: Base[];
}
interface Special extends Base {
  rank: number;
}

interface Named extends Special {
  extra: string;
}

/** @schema */
export interface Dataset {
  item_special_known: Named;
  [key: `item_${string}`]: Base;
  [key: `item_special_${string}`]: Special;
}
