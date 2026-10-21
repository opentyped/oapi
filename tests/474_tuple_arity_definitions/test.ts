/** @schema */
export interface Arity {
  required: [string, number];
  optional?: [string, number?];
  rest: [boolean, ...string[]];
}
