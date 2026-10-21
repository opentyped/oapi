enum Value {
  Allowed = 1,
  /** @hidden */
  Overflow = 1 / 0,
  /** @hidden */
  NotNumber = 0 / 0,
}
enum Empty {}
enum Hidden {
  /** @hidden */
  Only = 0 / 0,
}

/** @schema */
export interface Dataset {
  value: Value;
  empty: Empty;
  hidden?: Hidden;
}

/** @schema */
export type Impossible = Hidden;
