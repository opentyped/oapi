/** @schema */
export interface Dataset {
  /** @required */
  name?: string;
  /** @required false */
  count: number;
  /** @required true */
  child?: Dataset | null;
  /** @required ["value"] */
  nested: { value?: boolean };
}
