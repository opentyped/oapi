interface Original {
  /**
   * @rename "wire_name"
   * @required true
   * @minLength 2
   */
  name?: string;
  /**
   * @rename "child_wire"
   * @required true
   */
  child?: Original | null;
}

/** @schema */
export type Dataset = Readonly<Partial<Original>>;
