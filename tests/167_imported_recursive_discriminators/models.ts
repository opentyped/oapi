type CircleKind = 'circle' | 'round' | '__proto__';

interface CircleTag {
  kind: CircleKind;
}
interface Circle extends CircleTag {
  radius: number;
  parent?: Shape;
}
interface Rectangle {
  kind: 'rectangle';
  width: number;
  height: number;
}

/**
 * @discriminator kind
 */
export type Shape = Circle | Rectangle;

interface Pair<T> {
  /** @discriminator kind */
  tagged: T;
  plain: T;
}
export interface Pairs {
  /** @inline */
  value: Pair<Circle | Rectangle>;
}
