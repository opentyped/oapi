interface A {
  /**
   * @rename "type"
   * @required true
   */
  kind?: 'a';
  /** @discriminator type */
  parent?: A | B;
}
interface B {
  /** @rename "type" */
  status: 'b';
}

/**
 * @schema
 * @discriminator type
 */
export type Dataset = A | B;
