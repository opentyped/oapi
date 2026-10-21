/** @schema */
export interface Button {
  /** @jsonSchema {"type":"object","properties":{"label":{"const":"press"}},"required":["label"],"additionalProperties":false} */
  action: unknown;
  enabled: boolean;
}
