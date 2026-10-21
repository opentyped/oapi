type Original = {
  /** @minLength 2 */
  'line\nbreak': string;
  '"quoted"': Original | null;
  'back\\slash': number;
};
enum Key {
  Line = 'line\nbreak',
  Quote = '"quoted"',
}
/** @schema */
export interface Dataset {
  literal: Original['line\nbreak'];
  selected: Original[Key];
  quote: Original['"quoted"'];
}
