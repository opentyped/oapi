interface LeftValue {
  left: string;
}
interface RightValue {
  right: number;
}
interface Left {
  values: [string, ...LeftValue[]];
  /** @maxItems 3 */
  bounded: [string, ...LeftValue[]];
}
interface Right {
  values: [string, ...RightValue[]];
  bounded: [string, ...RightValue[]];
}

/** @schema */
export type Model = Left & Right;

/** @schema */
export type Fixed = { value: [LeftValue, ...LeftValue[]] } & { value: [RightValue, RightValue] };

/** @schema */
export type Mixed = { value: LeftValue[] } & { value: [RightValue, ...RightValue[]] };
