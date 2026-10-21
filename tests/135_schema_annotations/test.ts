/**
 * @schema
 * @title Transfer asset
 * @minProperties 3
 * @maxProperties 8
 */
export interface Asset {
  /** @readOnly true */
  readonly id: string;
  /** @writeOnly true */
  secret: string;
  /**
   * @contentEncoding base64
   * @contentMediaType application/json
   */
  payload?: string;
  /**
   * @minimum 0
   * @maximum 1000
   * @multipleOf 0.25
   */
  price: number;
  /**
   * @default "draft"
   * @examples ["draft", "published"]
   */
  state?: 'draft' | 'published';
  /**
   * @minItems 1
   * @maxItems 3
   * @uniqueItems true
   */
  tags?: string[];
  /** @deprecated true */
  retired?: string;
  previous?: Asset;
}
