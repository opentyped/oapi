interface Model {
  /** @minLength 2 */
  name: string;
  children: Model[];
}
type Items = Model[];
/** @schema */
export interface Dataset {
  first: Items[0];
  text: Items['0'];
  alternatives: Items[0 | 7];
}
