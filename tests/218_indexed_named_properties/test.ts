interface Value {
  /** @minLength 3 */
  name: string;
  children?: Model;
}
interface Detail {
  name: string;
  count: number;
  children?: Model;
}
/** @schema */
export interface Model {
  [key: string]: Value;
  special: Detail;
}
