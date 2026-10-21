/** @schema */
export type Impossible = { [K in 'required']: never };

/** @schema */
export interface Model {
  allowed: string;
  forbidden?: never;
  impossible?: Impossible;
}
