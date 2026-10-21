interface Meta {
  /** @minLength 2 */
  label: string;
}
interface Extra extends Meta {
  count: number;
}
interface Tag {
  meta: Meta;
}
interface Value {
  name: string;
}
interface Base extends Tag {
  [key: `item-${string}`]: Value;
}
/** @schema */
export interface Model extends Base {
  meta: Extra;
  enabled: boolean;
}
