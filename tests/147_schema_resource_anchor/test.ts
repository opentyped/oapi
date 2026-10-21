/**
 * @schema
 * @jsonSchema {"$id":"https://example.test/tree","$anchor":"tree","type":"object","properties":{"label":{"type":"string","minLength":1},"children":{"type":"array","items":{"$ref":"#tree"}}},"required":["label"],"additionalProperties":false}
 */
export type Tree = unknown;

/**
 * @schema
 * @jsonSchema {"$id":"https://example.test/forest.json","$anchor":"node","$defs":{"node":{"$id":"node.json","$anchor":"node","type":"object","properties":{"label":{"type":"string","minLength":1},"children":{"type":"array","items":{"$ref":"#node"}}},"required":["label"],"additionalProperties":false}},"type":"object","properties":{"entry":{"$ref":"node.json#node"}},"required":["entry"],"additionalProperties":false}
 */
export type Forest = unknown;
