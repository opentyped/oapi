type Flags<T> = { [K in keyof T]: boolean };
type Identity<T> = { [K in keyof T]: T[K] };
type Keys<T> = { [K in keyof T]: K };
type Mandatory<T> = { [K in keyof T]-?: T[K] };
type Repeat<T> = { [K in keyof T]: T };

/** @schema */
export interface Model {
  /** @inline */
  array: Flags<readonly string[]>;
  /** @inline */
  tuple: Flags<readonly [id: string, count?: number]>;
  /** @inline */
  rest: Flags<[id: string, ...tail: number[]]>;
  /** @inline */
  identity: Identity<[id: string, count?: number]>;
  /** @inline */
  keys: Keys<[id: string, count?: number]>;
  /** @inline */
  mandatory: Mandatory<[id: string, count?: number]>;
  /** @inline */
  repeat: Repeat<[string, ...number[]]>;
}
