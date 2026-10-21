/**
 * @title Source payload
 * @description A source model.
 * @nullable
 * @minProperties 1
 */
interface Base {
  name?: string;
}

/** @schema */
export type Model = Readonly<Base>;
