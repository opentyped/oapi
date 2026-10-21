/** @minLength 8 */
type Key = `item-${string}`;

/** @schema */
export type Model = Record<Key, string> & {
  fixed: boolean;
};
