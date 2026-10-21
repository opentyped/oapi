interface Model {
  /**
   * @readOnly
   * @minLength 2
   */
  id: string;
  /** @writeOnly */
  secret: string;
  /**
   * @deprecated false
   * @default true
   */
  active: boolean;
  /** @deprecated Use children instead. */
  previous?: PublicModel;
  children?: PublicModel[];
  /** @hidden */
  internal: string;
}

/**
 * @schema
 * @title Public model
 */
export type PublicModel = Readonly<
  Pick<Model, 'id' | 'secret' | 'active' | 'previous' | 'children' | 'internal'>
>;
