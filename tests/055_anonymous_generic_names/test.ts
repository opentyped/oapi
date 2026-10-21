interface Box<T> {
  value: T;
}

/** @schema */
export interface Model {
  one: Box<{ id: string }>;
  two: Box<{ id: number }>;
}
