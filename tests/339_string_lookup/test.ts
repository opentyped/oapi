/**
 * @minLength 4
 * @pattern ^code_
 */
type Code = string;
/** @schema */
export interface Dataset {
  original: Code;
  first: Code[0];
  all: Code[number];
  text: Code['0'];
  length: Code['length'];
  literal: 'alpha'[0];
  literalLength: 'alpha'['length'];
  template: `id_${string}`[number];
  mixed: Code[0 | 'length'];
}
