interface User {
  /** @minLength 2 */
  name: string;
  children?: Model;
}
interface UserIndex<T> {
  [key: `user_${string}`]: T;
}
interface CountIndex {
  [key: `count_${string}`]: number;
}
interface Base extends UserIndex<User>, CountIndex {
  version: 1;
}

/** @schema */
export type Model = Readonly<Base>;
