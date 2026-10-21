/** @schema */
export interface Model {
  /** @pattern ^item_[0-9]+$ */
  positive: `item_${number}`;
  /** @pattern ^item_-[0-9]+$ */
  negative?: `item_${number}` | null;
  /** @ref https://example.test/schemas/value.json */
  reference?: unknown;
}
