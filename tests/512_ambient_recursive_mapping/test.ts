import type { Decimal } from 'decimal.js';
/** @schema */
export type Price = Decimal;
/** @schema */
export type Tree = { kind: 'leaf'; price: Price } | { kind: 'branch'; children: Tree[] };
