type Key = `a-${string}` | string;

/** @schema */
export type Model = { [K in Key]: K };
