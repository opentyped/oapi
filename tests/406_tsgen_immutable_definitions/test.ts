/**
 * @schema
 * @jsonSchema {"type":"object","properties":{"name":{"type":"string"},"tags":{"type":"array","items":{"type":"string"}},"settings":{"type":"object","additionalProperties":{"type":"number"}},"point":{"const":[1,2],"description":"Origin coordinates"},"mode":{"enum":["on","off"],"type":"string","description":"Power mode"},"child":{"$ref":"#/components/schemas/Child"}},"required":["name","tags","settings","point","mode","child"],"additionalProperties":false}
 */
export type Widget = unknown;

/**
 * @schema
 * @jsonSchema {"type":"object","properties":{"flag":{"type":"boolean"}},"required":["flag"],"additionalProperties":false}
 */
export type Child = unknown;
