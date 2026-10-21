type CircleKind = 'circle' | 'round' | '__proto__';

interface CircleTag {
  kind: CircleKind;
}
interface Circle extends CircleTag {
  radius: number;
  /** @discriminator kind */
  parent?: Circle | Rectangle;
}
interface Rectangle {
  kind: 'rectangle';
  width: number;
  height: number;
}

/**
 * @schema
 * @discriminator kind
 */
export type Shape = Circle | Rectangle;

interface Pair<T> {
  /** @discriminator kind */
  tagged: T;
  plain: T;
}
/** @schema */
export interface Pairs {
  /** @inline */
  value: Pair<Circle | Rectangle>;
}
