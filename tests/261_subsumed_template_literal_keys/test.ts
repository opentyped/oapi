/** @minLength 8 */
type Template = `item-${string}`;
type Key = 'item-x' | Template;

/** @schema */
export type Model = { [K in Key]: string } & { kind: 'dictionary' };
