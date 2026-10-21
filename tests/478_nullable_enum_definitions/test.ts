/** @schema */
export interface Reading {
  /**
   * Sensor state.
   * @nullable
   */
  state: 'ok' | 'warn';
  /** @nullable */
  count: number;
}
