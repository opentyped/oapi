interface Box<T> {
  value: T;
  label: string;
}

/** @schema */
export interface StringBox {
  plain: Box<string>;
  pair: Box<{ left: number; right: number }>;
}
