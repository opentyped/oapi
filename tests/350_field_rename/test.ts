/** @schema */
export interface Dataset {
  /** @rename "wire_id" */
  id: number;
  /** @rename "\"quoted\"" */
  child?: Dataset;
  /**
   * @rename ""
   * @minLength 2
   * @required false
   */
  label: string;
  /** @rename "__proto__" */
  meta?: Dataset;
}
