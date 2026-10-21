interface Source {
  /** @required true */
  name?: string;
  /** @required false */
  count: number;
}

/** @schema */
export interface Dataset {
  selected?: Source['name'];
  count: Source['count'];
}
