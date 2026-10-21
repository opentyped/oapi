interface Left {
  value: string;
  next?: Left;
}
interface Right {
  count: number;
  next?: Right;
}

/** @schema */
export type Model = Left & Right;

/** @schema */
export type Extended = Model & { extra: boolean };
