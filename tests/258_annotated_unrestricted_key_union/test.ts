/** @minLength 8 */
type Template = `item-${string}`;
type Key = string | Template;

/** @schema */
export interface Model extends Readonly<Record<Key, string>> {
  kind: 'dictionary';
}
