interface Source {
  /** @minLength 3 */
  label?: string;
  child?: { value?: number };
  internal: unknown;
}
/** @schema */
export interface Model {
  label?: Source['label'];
  childValue?: NonNullable<Source['child']>['value'];
}
