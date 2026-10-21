/** @minLength 8 */
type Template = `item-${string}`;
type Key = 'fixed' | Template;
interface Value {
  label: string;
  next?: Model;
}

/** @schema */
export interface Model extends Readonly<Record<Key, Value>> {
  kind: 'dictionary';
}
