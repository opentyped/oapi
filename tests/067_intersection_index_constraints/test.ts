/** @schema */
export type Model = Record<string, string | number> & Record<string, number>;

/** @schema */
export type Named = Record<string, string | number> & { id: number };

/** @schema */
export type Conflict = Record<string, string> & { id: number };
