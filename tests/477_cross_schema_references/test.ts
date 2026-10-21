/**
 * @schema
 * @jsonSchema {"$id":"https://example.test/node","type":"object","properties":{"value":{"type":"string"},"peer":{"$ref":"https://example.test/leaf"}},"required":["value"],"additionalProperties":false}
 */
export type Node = unknown;

/**
 * @schema
 * @jsonSchema {"$id":"https://example.test/leaf","type":"object","properties":{"tag":{"type":"string"}},"required":["tag"],"additionalProperties":false}
 */
export type Leaf = unknown;
