interface LeftText {
  left: string;
}
interface LeftNumber {
  left: number;
}
interface RightValue {
  right: boolean;
}

/** @schema */
export type Model = { value: LeftText | LeftNumber } & { value: RightValue };
