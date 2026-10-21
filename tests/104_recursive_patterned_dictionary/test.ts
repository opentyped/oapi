interface Node {
  label: string;
  children?: Model;
}
/** @schema */
export interface Model {
  [key: `node-${string}`]: Node;
}
