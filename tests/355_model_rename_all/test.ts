/**
 * @schema
 * @renameAll camelCase
 */
export interface Dataset {
  /** @minLength 2 */
  first_name: string;
  HTTP_code: number;
  next_node?: Dataset;
  /** @rename "__proto__" */
  explicit_name?: Dataset;
  nested_value: { untouched_name: boolean };
}
