type Flags<T> = { [K in keyof T]: boolean };

/** @schema */
export interface Model {
  id: string;
  label?: string;
  /** @inline */
  flags: Flags<Model>;
}

/** @schema */
export interface Projection extends Flags<Model> {
  version: '1';
}
