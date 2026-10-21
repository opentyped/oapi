interface Inner {
  /** @minLength 2 */
  name: string;
}
interface Extra extends Inner {
  extra: string;
}
interface Base {
  /** @rename "nested_wire" */
  nested: Inner;
}

/** @schema */
export interface Dataset extends Base {
  /** @rename "nested_wire" */
  nested: Extra;
}
