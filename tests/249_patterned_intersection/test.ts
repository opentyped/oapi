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
export type Model = Base<Value> & {
  kind: 'dictionary';
  'item-special.+': Detail;
};
