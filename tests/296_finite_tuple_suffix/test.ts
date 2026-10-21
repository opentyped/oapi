interface Node {
  /** @minLength 2 */
  name: string;
  children?: Packet[];
}

/** @schema */
export type Packet = ['packet', ...([] | [Node]), true];
