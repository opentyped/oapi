interface Source {
  /** @minLength 3 */
  1: string;
  '2': number;
  name: boolean;
}
/** @schema */
export type Keys = keyof Source;
/** @schema */
export interface Model {
  numeric: Source[1];
  quoted: Source['2'];
  selected: Pick<Source, 1>;
}
