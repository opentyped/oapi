/**
 * @asType string
 * @pattern ^[0-9]+$
 */
type Decimal = bigint;

/** @schema */
export type Model = {
  amount: Decimal;
  /**
   * @asType string
   * @format uuid
   */
  id: { toString(): string };
  /**
   * @asType integer
   * @minimum 0
   */
  count: unknown;
  /** @asType boolean */
  active: unknown;
};
