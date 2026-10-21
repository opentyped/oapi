/** @schema @jsonSchema {"type":"array","items":{"type":"number"},"minItems":1,"maxItems":2} */
export type Bounded = unknown;

/** @schema @jsonSchema {"type":"array","items":false} */
export type Empty = unknown;

/** @schema @jsonSchema {"type":"array","items":false,"minItems":1} */
export type Impossible = unknown;

/** @schema @jsonSchema {"type":"array","items":{"type":"string"},"minItems":1} */
export type Nonempty = unknown;

/** @schema @jsonSchema {"type":"array","items":{"type":"string"},"maxItems":0} */
export type Zero = unknown;

/** @schema @jsonSchema {"type":"array","items":false,"maxItems":2} */
export type Closed = unknown;
