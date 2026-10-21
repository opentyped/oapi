/** @pattern ^item-[a-z]+$ */
type Key = `item-${string}`;

/** @schema */
export class Model {
  [key: Key]: string;
  fixed: boolean = true;
}
