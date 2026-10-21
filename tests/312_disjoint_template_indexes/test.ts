interface User {
  /** @minLength 2 */
  name: string;
  children?: Model;
}
/** @schema */
export interface Model {
  version: 1;
  [key: `user_${string}`]: User;
  [key: `count_${string}`]: number;
}
