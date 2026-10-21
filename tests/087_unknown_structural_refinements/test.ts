interface LeftValue {
  left: string;
}
interface RightValue {
  right: number;
}
interface Source {
  value: unknown;
  optional?: unknown;
  single?: unknown;
}
interface Left {
  value: LeftValue;
  optional?: LeftValue;
  single?: LeftValue;
}
interface Right {
  value: RightValue;
  optional?: RightValue;
}

/** @schema */
export type Model = Source & Left & Right;
