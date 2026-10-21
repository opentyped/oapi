/** @schema */
export interface Model {
  /**
   * Lifecycle state.
   * @default "active"
   * @examples [null,"archived"]
   */
  state: 'active' | 'archived';
  /**
   * Power mode.
   */
  mode: 'on' | 'off';
}
