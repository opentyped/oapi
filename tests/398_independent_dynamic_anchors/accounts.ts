/** @schema @jsonSchema {"$id":"https://example.test/accounts","$dynamicAnchor":"node","type":"object","properties":{"name":{"type":"string"},"children":{"type":"array","items":{"$dynamicRef":"#node"}}},"required":["name"],"additionalProperties":false} */
export type Tree = unknown;
