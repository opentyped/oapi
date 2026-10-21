/** @schemaName api.Address */
interface Address {
  /** @minLength 1 */
  city: string;
}
interface Node {
  value: string;
  next?: Node;
}
/** @minLength 5 */
type Label = string;

/** @schema */
export interface Model {
  /** @inline */
  address: Address;
  /** @inline */
  addresses: Address[];
  /** @inline */
  head: Node;
  /**
   * @inline
   * @minLength 2
   */
  label: Label;
  keep: Address;
}
