/** @minLength 8 */
type Key = `item-${string}`;
interface Value {
  /** @minLength 2 */
  name: string;
  children?: Model;
}
type Dictionary<K extends `item-${string}`, V> = Record<K, V> & {
  kind: 'dictionary';
};

/** @schema */
export interface Model extends Dictionary<Key, Value> {
  fixed: boolean;
}
