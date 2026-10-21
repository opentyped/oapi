/** @schema */
export interface Dataset {
  /** @minLength 2 */
  'line\nbreak': string;
  'back\\slash': number;
  '"quoted"'?: Dataset;
  "'single'": boolean;
  ['__proto__']?: Dataset;
  __typedapi_proto__?: boolean;
  // Preserve an escaped source spelling.
  // prettier-ignore
  "\u0061": string;
  0x10?: number;
}
