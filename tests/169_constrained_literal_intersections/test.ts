/** @minLength 3 */
type Identifier = string;
type Choice = Identifier & ('x' | 'valid');
type Impossible = Identifier & 'x';
/** @minimum 10 */
type Minimum = number;
type Quantity = Minimum & (1 | 12);

/** @schema */
export interface Model {
  choice: Choice;
  quantity: Quantity;
  impossible?: Impossible;
}
