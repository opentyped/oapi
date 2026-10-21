/** @pattern ^[a-z]+$ */
type Key = string;

/** @schema */
export class Model {
  [key: Key]: string;
  category: string = 'root';
}
