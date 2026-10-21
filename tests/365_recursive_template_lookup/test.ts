interface Leaf {
  /** @minLength 2 */
  value: string;
}
interface Tree {
  [key: `node_${string}`]: Tree;
  [key: `leaf_${string}`]: Leaf;
}

/** @schema */
export interface Dataset {
  tree: Tree;
  value: Tree[keyof Tree];
}
