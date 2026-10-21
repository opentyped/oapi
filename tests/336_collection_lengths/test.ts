interface Model {
  /** @minLength 2 */
  name: string;
  children: Model[];
}
type Items = Model[];
/** @schema */
export interface Dataset {
  arrayLength: Items['length'];
  fixedLength: [Model, Model]['length'];
  optionalLength: [Model, Model?]['length'];
  emptyLength: []['length'];
  restLength: [Model, ...Model[]]['length'];
  unionLength: ([Model] | [Model, Model])['length'];
  mixed: Items[0 | 'length'];
  pairMixed: [Model, boolean][0 | 'length'];
}
