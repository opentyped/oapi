interface LeftValue {
  left: string;
}
interface RightValue {
  right: number;
}

/** @schema */
export type Model = { value: LeftValue | string } & { value: RightValue | string };

/** @schema */
export type Narrowed = { value: LeftValue | string } & { value: RightValue };

/** @schema */
export type Impossible = { value: LeftValue | string } & { value: number | boolean };
