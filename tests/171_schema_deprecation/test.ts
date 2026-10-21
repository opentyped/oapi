/** @deprecated Use CurrentCode. */
type OldCode = string;

/**
 * @schema
 * @deprecated Use the replacement model.
 */
export interface Model {
  /** @deprecated Use current instead. */
  old: OldCode;
  /** @deprecated */
  legacy?: number;
  /** @deprecated false */
  current: string;
  next?: Model;
}
