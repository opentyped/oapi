interface Value {
  /** @minLength 2 */
  name: string;
  children?: Model;
}
interface Detail extends Value {
  count: number;
}
interface Base<T> {
  [key: `item-${string}`]: T;
}
/** @schema */
export interface Model extends Base<Value> {
  [key: `item-${string}`]: Detail;
  kind: 'dictionary';
}
