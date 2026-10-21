/** @minLength 4 */
type A = `a-${string}`;
/** @minLength 5 */
type B = `b-${string}`;
type Key = A | B;
interface Base<T> {
  [key: Key]: T;
}
interface Value {
  label: string;
  next?: Model;
}

/** @schema */
export interface Model extends Base<Value> {
  fixed: boolean;
}
