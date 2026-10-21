interface Left {
  value: string;
  /** @maxItems 2 */
  children?: Left[];
}
interface Right {
  count: number;
  children?: Right[];
}

/** @schema */
export type Model = Left & Right;
