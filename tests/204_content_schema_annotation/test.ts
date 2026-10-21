/** @schema */
export interface Decoded {
  name: string;
}
/**
 * @contentEncoding base64
 * @contentMediaType application/json
 * @contentSchema {"$ref":"#/components/schemas/Decoded"}
 * @minLength 1
 */
type Encoded = string;

/** @schema */
export interface Envelope {
  raw: Encoded;
  /**
   * @inline
   * @contentSchema {"type":"array","items":{"type":"number"}}
   */
  list: Encoded;
  parent?: Envelope;
}
