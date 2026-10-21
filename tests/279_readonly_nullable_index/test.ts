/** @minLength 8 */
type Key = string;
interface Dictionary {
  [key: Key]: string;
}
/** @nullable */
interface Base extends Dictionary {
  category: string;
}

/** @schema */
export type Model = Readonly<Base>;
