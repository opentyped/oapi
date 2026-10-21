interface Model {
  /**
   * @rename "wire_name"
   * @required true
   * @minLength 2
   */
  name?: string;
  /** @rename "__proto__" */
  next?: Model;
}

/** @schema */
export interface Dataset {
  /** @inline */
  value: Model;
}
