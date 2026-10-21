interface Source {
  value: unknown;
}
interface Refined {
  value: string;
}

/** @schema */
export type Model = Source & Refined;
