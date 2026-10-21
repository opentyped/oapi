import type * as Local from './local.js';

interface Thenable<T> {
  then(callback: (value: T) => unknown): unknown;
}
interface WireNode {
  /** @minLength 2 */
  id: string;
  next?: Awaited<Thenable<WireNode>>;
}
/** @minLength 3 */
type Label = string;
/** @schema */
export interface Result {
  value: Awaited<Thenable<WireNode>>;
  nested: Awaited<Promise<Thenable<WireNode>>>;
  choice: Awaited<Promise<string> | number | null>;
  label: Awaited<Promise<Label>>;
  local: Awaited<Thenable<Local.Date>>;
}
/** @schema */
export type AwaitedNode = Awaited<Thenable<WireNode>>;
