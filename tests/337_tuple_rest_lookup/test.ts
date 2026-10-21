interface Model {
  /** @minLength 2 */
  name: string;
  children: Model[];
}
type Row = [Model, ...Model[]];
/** @schema */
export interface Dataset {
  head: Row[0];
  firstRest: Row[1];
  farRest: Row[9];
  stringRest: Row['3'];
  all: Row[number];
}
