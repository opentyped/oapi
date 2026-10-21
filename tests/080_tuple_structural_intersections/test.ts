interface LeftValue {
  left: string;
}
interface RightValue {
  right: number;
}

/** @schema */
export type Model = { value: [LeftValue, string?] } & { value: [RightValue, number?] };

/** @schema */
export type Conflict = { value: [LeftValue] } & { value: [RightValue, string] };
