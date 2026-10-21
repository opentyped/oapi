/** @minLength 8 */
type Key = `item-${string}`;

/** @schema */
export interface Model {
  [key: Key]: string;
  fixed: boolean;
}
