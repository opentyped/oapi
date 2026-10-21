type Original = {
  /** @minLength 2 */
  'line\nbreak': string;
  '"quoted"': Original | null;
  'back\\slash': number;
};
/** @schema */
export type Dataset = { [K in keyof Original]?: Original[K] };
