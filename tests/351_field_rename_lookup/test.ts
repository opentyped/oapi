interface Source {
  /**
   * @rename "wire_value"
   * @minLength 2
   */
  value: string;
}

/** @schema */
export interface Dataset {
  selected?: Source['value'];
}
