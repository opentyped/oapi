/**
 * @schema
 * @jsonSchema {"$id":"https://example.test/catalog.json","$defs":{"record":{"type":"object","properties":{"label":{"type":"string"},"choice":{"enum":["a","b"]}},"required":["label"],"additionalProperties":false}},"type":"object","properties":{"label":{"$ref":"#/$defs/record/properties/label"},"choice":{"$ref":"#/$defs/record/properties/choice"},"record":{"$ref":"#/$defs/record"}},"required":["label","record","choice"],"additionalProperties":false}
 */
export type Catalog = unknown;
