/** @minLength 8 */
type Key = `item-${string}`;

/** @schema */
export interface Model extends Record<Key, string> {
  fixed: boolean;
}
