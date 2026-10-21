/** @minLength 8 */
type Template = `item-${string}`;
type Key = 'fixed' | Template;

/** @schema */
export type Model = { [K in Key]: string };
