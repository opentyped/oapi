interface Left {
  value: string;
  next?: Left;
}
interface Right {
  count: number;
  next?: Right;
}

/**
 * @schema
 * @minProperties 3
 */
export type Tight = Left & Right;
