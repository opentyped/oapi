/** @minLength 4 */
type A = `a-${string}`;
/** @minLength 5 */
type B = `b-${string}`;
type Key = 'fixed' | A | B;

/** @schema */
export type Model = { [K in Key]: { label: string } };
