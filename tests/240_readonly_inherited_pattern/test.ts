/** @minLength 8 */
type Key = `item-${string}`;

interface Dictionary extends Record<Key, string> {
  fixed: boolean;
  /** @minLength 2 */
  note?: string;
}

/** @schema */
export interface Model extends Readonly<Dictionary> {
  count: number;
}
