type NoValue = never;
enum Hidden {
  /** @hidden */
  Item = 1,
}

/** @schema */
export interface RequiredAlias {
  value: NoValue;
}

/** @schema */
export interface RequiredEnum {
  value: Hidden;
}

/** @schema */
export interface OptionalAlias {
  value?: NoValue;
  allowed: string;
}

/** @schema */
export interface PresenceOverride {
  /** @required false */
  value: NoValue;
  allowed: string;
}
