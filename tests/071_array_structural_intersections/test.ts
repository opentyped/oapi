interface LeftValue {
  left: string;
}
interface RightValue {
  right: number;
}
interface Left {
  /** @minItems 1 */
  values: LeftValue[];
  nested: LeftValue[][];
}
interface Right {
  /** @maxItems 3 */
  values: RightValue[];
  nested: RightValue[][];
}

/** @schema */
export type Model = Left & Right;
