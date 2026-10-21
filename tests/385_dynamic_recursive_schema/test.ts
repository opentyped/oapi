/**
 * @schema
 * @jsonSchema {"$id":"https://example.test/tree","$dynamicAnchor":"node","type":"object","properties":{"label":{"type":"string"},"children":{"type":"array","items":{"$dynamicRef":"#node"}}},"required":["label"],"additionalProperties":false}
 */
export type Tree = unknown;
