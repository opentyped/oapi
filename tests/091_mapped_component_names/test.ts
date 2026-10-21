interface User {
  id: string;
}
interface Box<T> {
  value: T;
}

/** @schema */
export interface Model {
  one: Box<{ [K in keyof User]: User[K] }>;
  two: Box<{ [K in keyof User]?: User[K] }>;
  flags: Box<{ [K in keyof Model]: boolean }>;
}

interface Pair<A, B> {
  one: Box<A>;
  two: Box<B>;
}

/** @schema */
export interface PairModel {
  value: Pair<{ literal: number }, { [K in keyof User]: User[K] }>;
}
