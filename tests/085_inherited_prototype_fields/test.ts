interface Base {
  base: string;
}

/** @schema */
export interface Extended extends Base {
  /** Declared presence flag. */
  hasOwnProperty: boolean;
}

/** @schema */
export type Model = { hasOwnProperty: string } & { id: number };
