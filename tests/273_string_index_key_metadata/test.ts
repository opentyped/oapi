/** @minLength 8 */
type Key = string;

/** @schema */
export interface Model {
  [key: Key]: string;
  category: string;
}
