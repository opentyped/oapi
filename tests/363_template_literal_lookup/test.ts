interface Base {
  /** @minLength 2 */
  name: string;
  children: Base[];
}
interface Special extends Base {
  rank: number;
}

type General = Record<`item_${string}`, Base>;
type Narrow = Record<`item_special_${string}`, Special>;
type Combined = General & Narrow & { label?: string };

/** @schema */
export interface Dataset {
  general: Combined['item_general'];
  special: Combined['item_special_key'];
}
