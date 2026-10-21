/**
 * @schema
 * @jsonSchema {"type":"string","anyOf":[{"const":"a"},{"const":"b"}]}
 */
export type Any = unknown;

/**
 * @schema
 * @jsonSchema {"type":"string","oneOf":[{"const":"a"},{"const":"b"}]}
 */
export type One = unknown;

/**
 * @schema
 * @jsonSchema {"type":"string","anyOf":[{"const":"a"},{"const":"b"}],"oneOf":[{"const":"b"},{"const":"c"}]}
 */
export type Both = unknown;

/**
 * @schema
 * @jsonSchema {"allOf":[false]}
 */
export type Impossible = unknown;
