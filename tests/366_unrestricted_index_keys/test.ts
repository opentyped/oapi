interface Direct {
  [key: string]: string;
  [key: `item_${string}`]: string;
}
interface Base {
  [key: string]: string;
}
interface Inherited extends Base {
  [key: `item_${string}`]: string;
}
type Combined = Record<string, string> & Record<`item_${string}`, string>;
type Keys<T> = keyof T;

/** @schema */
export interface Dataset {
  direct: keyof Direct;
  inherited: keyof Inherited;
  combined: keyof Combined;
  generic: Keys<Combined>;
}
