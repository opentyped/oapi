/** @schema */
export interface Model {
  /**
   * @contentEncoding base64
   * @contentMediaType application/json
   * @contentSchema {"type":"object","properties":{"name":{"type":"string"}},"required":["name"],"additionalProperties":false}
   * @minLength 1
   */
  encoded: string;
  /** @contentSchema false */
  impossibleContent: string;
  /**
   * @contentSchema {"type":"number"}
   * @jsonSchema {"type":"string","contentSchema":{"type":"integer"}}
   */
  wire: unknown;
  next?: Model;
}
