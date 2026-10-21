/** @schema */
export interface Measurement {
  /**
   * Severity bucket.
   * @default 2
   */
  level: 1 | 2 | 3;
  /** Sampling rate. */
  rate: 0.5 | 1 | 2;
}
