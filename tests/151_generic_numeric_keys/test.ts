interface Source {
  1: string;
  '2': number;
  name: boolean;
  /** @hidden */
  3: unknown;
}
type KeysOf<T> = keyof T;
type Again<T> = KeysOf<T>;
interface Box<T> {
  keys: keyof T;
  optional?: keyof T;
  list: (keyof T)[];
  forwarded: Again<T>;
}
/** @schema */
export type Keys = Again<Source>;
/** @schema */
export type Model = Box<Source>;
