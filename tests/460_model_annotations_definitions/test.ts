/**
 * @schema
 * @default "active"
 * @examples ["active", "paused"]
 */
export interface State {
  /** Current lifecycle state. */
  value: string;
}
