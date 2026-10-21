interface LeftValue {
  left: string;
}
interface RightValue {
  right: number;
}

/** @schema */
export type Model = { value: LeftValue | string[] } & { value: RightValue | number[] };

/** @schema */
export type Empty = { values: string[] } & { values: number[] };

interface RequiredStrings {
  /** @minItems 1 */
  values: string[];
}

/** @schema */
export type Nonempty = RequiredStrings & { values: number[] };
