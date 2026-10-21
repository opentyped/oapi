/** @minLength 8 */
type Key = `item-${string}`;

/** @schema */
export interface Model extends Readonly<Readonly<Record<Key, string>>> {
  fixed: boolean;
}
