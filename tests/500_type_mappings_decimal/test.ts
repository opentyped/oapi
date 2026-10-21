import type { Decimal } from 'decimal.js';
import type { Decimal as NamedDecimal } from 'decimal.js';
import type { Price } from './barrel.js';
import type { Decimal as UnrelatedDecimal } from './other.js';

type Money = Decimal;

/** @schema */
export interface Invoice {
  total: Decimal;
  alias: Money;
  named: NamedDecimal;
  reexported: Price;
  history: Decimal[];
  readonly: Readonly<Decimal>;
  optional?: Decimal;
  nullable: Decimal | null;
  nested: { amount: Decimal };
  unrelated: UnrelatedDecimal;
  /** @asType number */
  override: Decimal;
}
