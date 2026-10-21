interface Source {
  id: string;
  name?: string;
  count?: number;
  /** @hidden */
  internal: unknown;
}
interface MaybeNever {
  forbidden?: never;
}
type Flags<T> = { [K in keyof T]: boolean };
type Renamed<T> = { [K in keyof T as `flag_${K & string}`]: boolean };

/** @schema */
export interface Model extends Flags<Source> {
  version: '1';
}

/** @schema */
export interface RequiredModel extends Required<Source> {
  version: '1';
}

/** @schema */
export interface Impossible extends Required<MaybeNever> {
  version: '1';
}

/** @schema */
export interface Reanimated extends Flags<MaybeNever> {
  version: '1';
}

/** @schema */
export interface Remapped extends Renamed<Source> {
  version: '1';
}
