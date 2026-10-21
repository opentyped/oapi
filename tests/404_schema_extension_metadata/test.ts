/**
 * @schema
 * @extensions {"x-owner":"accounts","x-data":{"$ref":"#/not-a-schema","nested":{"type":"invalid-schema"}}}
 */
export interface Model {
  /**
   * @minLength 2
   * @extensions {"x-role":"identifier"}
   */
  id: string;
  /**
   * @extensions {"x-origin":"annotation","x-codec":"text"}
   * @jsonSchema {"type":"string","x-origin":"explicit"}
   */
  serialized: unknown;
  child?: Model;
}
