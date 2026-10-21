type Concat<T extends readonly unknown[], U extends readonly unknown[]> = [...T, ...U];
type Middle<T extends readonly unknown[], U extends readonly unknown[]> = [
  'start',
  ...T,
  boolean,
  ...U,
];

/** @schema */
export interface Model {
  /** @inline */
  row: Concat<string[], number[]>;
  /** @inline */
  middle: Middle<readonly string[], readonly number[]>;
}
