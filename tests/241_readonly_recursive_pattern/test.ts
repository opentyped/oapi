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
interface Dictionary<T> extends Base<T> {
  kind: 'dictionary';
}
/** @schema */
export interface Model extends Readonly<Dictionary<Value>> {
  'item-special.+': Detail;
}
