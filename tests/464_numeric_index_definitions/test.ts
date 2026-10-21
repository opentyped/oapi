/** @schema */
export interface Row {
  title: string;
  /** @jsonSchema {"type":"object","propertyNames":{"pattern":"^(0|[1-9][0-9]*)$"},"additionalProperties":{"type":"string"}} */
  cells: { [key: number]: string };
}
