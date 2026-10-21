interface Circle {
  kind: 'circle';
  radius: number;
}
interface Rectangle {
  kind: 'rectangle';
  width: number;
}

/** @schema */
export interface Drawing {
  id: string;
  /** @discriminator kind */
  shape: Circle | Rectangle;
}
