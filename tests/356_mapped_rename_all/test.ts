/** @renameAll SCREAMING-KEBAB-CASE */
interface Original {
  /**
   * @minLength 2
   * @required true
   */
  first_name?: string;
  child_node?: Original;
}

/** @schema */
export type Dataset = Readonly<Partial<Original>>;
