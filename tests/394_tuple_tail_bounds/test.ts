/** @schema @jsonSchema {"type":"array","prefixItems":[{"type":"string"}],"items":{"type":"number"},"minItems":2,"maxItems":3} */
export type Bounded = unknown;

/** @schema @jsonSchema {"type":"array","prefixItems":[{"type":"string"}],"items":{"type":"number"},"minItems":3} */
export type RequiredTail = unknown;

/** @schema @jsonSchema {"type":"array","prefixItems":[{"type":"string"}],"items":false,"minItems":2} */
export type Impossible = unknown;
