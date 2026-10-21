/**
 * @schema
 * @required ["id", "price"]
 * @minProperties 2
 * @maxProperties 5
 */
export interface Model {
  /** @readOnly true */
  id?: string;
  /**
   * @multipleOf 0.5
   * @minimum 0
   * @exclusiveMaximum 100
   */
  price: number;
  /**
   * @writeOnly true
   * @minLength 3
   * @maxLength 20
   */
  secret?: string;
  /**
   * @contentEncoding base64
   * @contentMediaType application/json
   */
  payload?: string;
  /**
   * @uniqueItems true
   * @minItems 1
   * @maxItems 3
   */
  labels?: string[];
}
