/** @schema */
export interface Address {
  city: string;
}

/** @schema */
export interface Model {
  /** @ref https://example.test/schemas/decimal.json */
  balance: bigint;
  /** @ref #/components/schemas/Address */
  address: unknown;
}
