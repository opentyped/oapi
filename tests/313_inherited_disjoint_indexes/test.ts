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
/** @schema */
export interface Model extends UserIndex<User>, CountIndex {
  version: 1;
}
