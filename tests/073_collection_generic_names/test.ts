interface User {
  id: string;
}
interface Box<T> {
  value: T;
}

/** @schema */
export interface Model {
  one: Box<User[]>;
  two: Box<Array<User>>;
}
