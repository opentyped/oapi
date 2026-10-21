type Select<T = string> = T extends `item-${string}` ? { accepted: T } : { rejected: T };
/** @schema */
export interface Model {
  broad: Select<string>;
  compatible: Select<`item-${string}`>;
  incompatible: Select<`other-${string}`>;
  defaulted: Select;
}
