/** @minLength 8 */
type Key = string;
interface Base<T> {
  [key: Key]: T;
}
interface Value {
  /** @minLength 2 */
  name: string;
  next?: Model;
}

/** @schema */
export interface Model extends Readonly<Base<Value>> {
  category: Value;
}
