/** @schema @jsonSchema {"$id":"https://example.test/billing","$dynamicAnchor":"node","type":"object","properties":{"balance":{"type":"number"},"children":{"type":"array","items":{"$dynamicRef":"#node"}}},"required":["balance"],"additionalProperties":false} */
export type Tree = unknown;
