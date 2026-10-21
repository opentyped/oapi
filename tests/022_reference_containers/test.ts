/** @ref https://example.test/schemas/database-id.json */
type DatabaseId = bigint;

/** @schema */
export interface Model {
  ids: DatabaseId[];
  alternate: Array<DatabaseId>;
  maybe: DatabaseId | null;
  /** @pattern ^id_[0-9]+$ */
  code: `id_${number}` | null;
}
