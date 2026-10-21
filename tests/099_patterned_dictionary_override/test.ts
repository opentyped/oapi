/**
 * @schema
 * @jsonSchema {"type":"object","patternProperties":{"^item-[\\s\\S]*$":{"type":"object","properties":{"id":{"type":"string"}},"required":["id"],"additionalProperties":false}},"additionalProperties":false}
 */
export interface Model {
  [key: `item-${string}`]: { id: string };
}
