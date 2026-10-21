interface User {
  id: string;
}

enum State {
  Active = 'active',
  Idle = 'idle',
}

type Flags<T> = { [K in keyof T]: boolean };
type Rename<T> = { [K in keyof T as `flag_${K & string}`]: boolean };

/** @schema */
export interface Model {
  /** @inline */
  value: Flags<string | 7 | null | User | number[] | [string, number?]>;
  /** @inline */
  renamed: Rename<string | User>;
  /** @inline */
  literal: Flags<'ready'>;
  /** @inline */
  state: Flags<State>;
}

/** @schema */
export type Impossible = Flags<never>;
