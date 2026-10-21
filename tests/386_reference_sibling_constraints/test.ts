/**
 * @schema
 * @jsonSchema {"type":"string","enum":["draft","published"]}
 */
export type Status = unknown;

/**
 * @schema
 * @jsonSchema {"$ref":"#/components/schemas/Status","const":"published"}
 */
export type Published = unknown;

/**
 * @schema
 * @jsonSchema {"$ref":"#/components/schemas/Status","type":"number"}
 */
export type Impossible = unknown;

/**
 * @schema
 * @jsonSchema {"type":"object","properties":{"label":{"type":"string"}},"additionalProperties":false}
 */
export type Body = unknown;

/**
 * @schema
 * @jsonSchema {"$ref":"#/components/schemas/Body","required":["label"]}
 */
export type RequiredBody = unknown;
