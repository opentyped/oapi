interface Original {
  /**
   * @required true
   * @minLength 2
   */
  name?: string;
  /** @required false */
  count: number;
  /** @required true */
  child?: Original | null;
}

/** @schema */
export type Dataset = Readonly<Partial<Original>>;
