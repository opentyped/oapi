/** @minLength 3 */
type Label = string;

interface Node {
  label: NoInfer<Label>;
  next?: NoInfer<Node>;
}

/** @schema */
export interface Model {
  label: NoInfer<Label>;
  plain: NoInfer<string>;
  labels: NoInfer<readonly Label[]>;
  head: NoInfer<Node>;
}
