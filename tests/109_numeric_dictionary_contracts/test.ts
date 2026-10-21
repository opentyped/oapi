/** @schema */
export type Finite = { [K in 1 | 2]: string };

/**
 * @schema
 * @jsonSchema {"type":"object","propertyNames":{"pattern":"^(0|[1-9][0-9]*)$"},"additionalProperties":{"type":"string"}}
 */
export type IntegerKeys = Record<number, string>;

/** @schema */
export interface EmptyNumeric {
  label?: string;
  [key: number]: never;
}
