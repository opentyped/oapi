/** @minLength 4 */
type A = `a-${string}`;
/** @minLength 5 */
type B = `b-${string}`;
type Key = A | B;

/** @schema */
export interface Model extends Readonly<Record<Key, string>> {
  fixed: boolean;
}
