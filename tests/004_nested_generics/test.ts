interface Box<T> {
  value: T;
  next?: Box<T>;
}
/** @schema */
export type Model = Box<Box<string>>;
