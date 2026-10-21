/**
 * @title Encoded text
 * @contentEncoding base64
 * @minLength 2
 */
type Encoded = string;

/** @schema */
export interface Packet {
  raw: Encoded;
  /**
   * @inline
   * @title Inline hex
   * @contentEncoding base16
   * @maxLength 4
   */
  value: Encoded;
  parent?: Packet;
}
