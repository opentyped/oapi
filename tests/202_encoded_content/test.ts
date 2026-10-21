/**
 * @contentEncoding base64
 * @contentMediaType application/octet-stream
 */
type Encoded = string;

/** @jsonSchema {"type":"string","contentEncoding":"base64","contentMediaType":"application/json","contentSchema":{"type":"object","properties":{"name":{"type":"string"}},"required":["name"],"additionalProperties":false}} */
type EncodedJson = string;

/** @schema */
export interface EncodedDocument {
  raw: Encoded;
  /**
   * @inline
   * @contentEncoding quoted-printable
   * @contentMediaType text/plain
   */
  text: Encoded;
  /**
   * @inline
   * @contentMediaType application/problem+json
   */
  json: EncodedJson;
  parent?: EncodedDocument;
}
