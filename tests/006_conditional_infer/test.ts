interface Source {
  payload: { id: string; value: number };
}
/** @schema */
export type Model = Source extends { payload: infer P } ? P : never;
