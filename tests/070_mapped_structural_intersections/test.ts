type Flags<T> = { [K in keyof T]: boolean };
interface Left {
  id: string;
  flags: Flags<Left>;
}
interface Right {
  count: number;
  flags: Flags<Right>;
}

/** @schema */
export type Model = Left & Right;
