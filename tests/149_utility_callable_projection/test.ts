interface Entity {
  /** @minLength 2 */
  id: string;
  name: string;
  /** Internal lifecycle hook. */
  callback?(input: Map<string, Entity>): void;
  callback?(input: RegExp): Promise<Entity>;
  factory: new () => Entity;
  internal: unknown;
}
/** @schema */
export type Selected = Pick<Entity, 'id' | 'name'>;
/** @schema */
export type Omitted = Omit<Required<Partial<Entity>>, 'callback' | 'factory' | 'internal'>;
/** @schema */
export type Keys = keyof Entity;
/** @schema */
export type Labels = { [K in keyof Entity]: string };

type Rename<T> = {
  [K in keyof T as K extends 'callback' ? 'hook' : K]: T[K];
};
/** @schema */
export type Renamed = Omit<Rename<Partial<Entity>>, 'hook' | 'factory' | 'internal'>;
