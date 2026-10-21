interface Model {
  /** @minLength 2 */
  name: string;
  children: Model[];
}
type Row = [string, ...Model[], number, boolean];
/** @schema */
export interface Dataset {
  first: Row[0];
  startVariable: Row[1];
  nextVariable: Row[2];
  lateVariable: Row[9];
  all: Row[number];
  length: Row['length'];
}
