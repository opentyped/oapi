/** @minProperties 2 */
interface LeftValue {
  left: string;
  shared: string | number;
}
/** @maxProperties 3 */
interface RightValue {
  right: number;
  shared: number;
}
interface Left {
  value: LeftValue;
  optional?: LeftValue;
}
interface Right {
  value: RightValue;
  optional?: RightValue;
}

/** @schema */
export type Model = Left & Right;

/** @schema */
export type Dictionary = Record<string, LeftValue> & Record<string, RightValue>;
