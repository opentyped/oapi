interface Value {
  /** @minLength 2 */
  name: string;
}
interface Detail extends Value {
  count: number;
}
interface Base {
  [key: `item-${string}`]: Value[];
}
interface Dictionary extends Base {
  'item-pair': [Detail, Detail];
}
/** @schema */
export interface Model extends Readonly<Dictionary> {
  kind: 'dictionary';
}
