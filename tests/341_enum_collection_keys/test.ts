interface Model {
  /** @minLength 2 */
  name: string;
  children: Model[];
}
enum Position {
  Head = 0,
  Rest = 3,
}
enum Pair {
  Head = 0,
  Flag = 1,
}
enum StringKey {
  First = '0',
  Length = 'length',
}
enum LengthKey {
  Length = 'length',
}
type Row = [Model, ...Model[]];
/** @schema */
export interface Dataset {
  array: Model[][Position];
  rest: Row[Position];
  pair: [Model, boolean][Pair];
  string: string[StringKey];
  length: [Model, boolean][LengthKey];
  mixed: (string | Model[])[StringKey];
}
