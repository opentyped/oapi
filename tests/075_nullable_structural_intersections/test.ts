interface LeftValue {
  left: string;
}
interface RightValue {
  right: number;
}
interface Left {
  value: LeftValue | null;
  required: LeftValue | null;
  optional?: LeftValue | null;
}
interface Right {
  value: RightValue | null;
  required: RightValue;
  optional?: RightValue | null;
}

/** @schema */
export type Model = Left & Right;
