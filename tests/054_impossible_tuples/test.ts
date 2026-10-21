/** @schema */
export type Impossible = [never];

/** @schema */
export type NamedImpossible = [value: never];

/** @schema */
export type MixedImpossible = [string, never, number];

/** @schema */
export type Optional = [string, never?];

/** @schema */
export type Rest = [string, ...never[]];
