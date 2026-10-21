type NoValue = never;

/** @nullable */
type NullableValue = never;

/** @schema */
export interface NullableProperty {
  /** @nullable */
  value: NoValue;
}

/** @schema */
export interface NullableAlias {
  value: NullableValue;
}
