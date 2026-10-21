/** @minLength 8 */
type Key = `item-${string}`;
interface Base<T> {
  [key: Key]: T;
}
interface Value {
  name: string;
  next?: Model;
}

/** @schema */
export interface Model extends Readonly<Base<Value>> {
  fixed: boolean;
}
