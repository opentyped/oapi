type Shape<T> = T extends readonly (infer E)[]
  ? Shape<E>[]
  : T extends object
    ? { [K in keyof T]: Shape<T[K]> }
    : T;

interface Node {
  id: string;
  children?: readonly Node[];
}
/** @schema */
export interface Model {
  recursive: Shape<Node>;
  rows: Shape<readonly Node[]>;
}
