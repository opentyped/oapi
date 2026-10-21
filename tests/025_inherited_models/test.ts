class Entity<T> {
  constructor(public readonly id: T) {}
}

/** @schema */
export class Model extends Entity<string> {
  constructor(
    id: string,
    public name: string,
  ) {
    super(id);
  }
}

interface ImpossibleBase {
  value: never;
}

/** @schema */
export interface Impossible extends ImpossibleBase {
  label: string;
}
