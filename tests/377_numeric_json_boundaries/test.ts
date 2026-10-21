/* eslint-disable no-loss-of-precision -- Intentional overflow and underflow in type-level fixtures. */
enum Numeric {
  NotNumber = 0 / 0,
}

/** @schema */
export interface Dataset {
  maximum: 1.7976931348623157e308;
  minimum: 5e-324;
  underflow: 1e-400;
  negativeZero: -0;
  anyNumber: typeof Infinity;
  positive: `${1e400}`;
  negative: `${-1e400}`;
  notNumber: `${Numeric.NotNumber}`;
}
