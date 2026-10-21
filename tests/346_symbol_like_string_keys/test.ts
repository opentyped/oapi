const key = '__@computed';
enum Key {
  Value = '__@enum',
}

/** @schema */
export interface Dataset {
  /** @minLength 2 */
  '__@literal': string;
  [key]?: Dataset;
  [Key.Value]: number;
}
