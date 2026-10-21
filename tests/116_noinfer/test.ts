import type { Shadow, InferenceBarrier } from './local.js';

/** @minLength 2 */
type Label = string;
interface WireNode {
  id: Label;
  next?: NoInfer<WireNode>;
}
interface Box<T> {
  value: NoInfer<T>;
}
/** @schema */
export interface Model {
  value: NoInfer<string>;
  label: NoInfer<Label>;
  head: NoInfer<WireNode>;
  list: NoInfer<readonly WireNode[]>;
  choice: NoInfer<'a' | 'b'>;
  box: Box<string>;
  shadow: Shadow;
  imported: InferenceBarrier<number>;
}
