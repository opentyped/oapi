type CircleKind = 'circle' | 'round' | '__proto__';

interface CircleTag {
  kind: CircleKind;
}
interface Circle extends CircleTag {
  radius: number;
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
