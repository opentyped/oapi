interface Source {
  id: string;
  name?: string;
}
type Selected<T, K extends keyof T> = { [P in K]: boolean };

/** @schema */
export interface Model extends Selected<Source, 'id' | 'name'> {
  version: '1';
}

type Chain<T, K extends keyof T, P extends K> = { [Key in P]: boolean };
type Concrete<K extends keyof Source> = { [Key in K]: boolean };
type Keys<T> = keyof T;
type Aliased<T> = { [Key in Keys<T>]: boolean };

/** @schema */
export interface Chained extends Chain<Source, 'id' | 'name', 'name'> {
  version: '1';
}

/** @schema */
export interface Fixed extends Concrete<'name'> {
  version: '1';
}

/** @schema */
export interface Alias extends Aliased<Source> {
  version: '1';
}
