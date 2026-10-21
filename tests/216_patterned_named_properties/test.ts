interface Value {
  /** @minLength 1 */
  name: string;
  children?: Model;
}
interface Detail extends Value {
  count: number;
}
/** @schema */
export interface Model {
  kind: 'dictionary';
  [key: `item-${string}`]: Value;
  'item-special.+': Detail;
}
