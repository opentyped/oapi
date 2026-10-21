import type { Value } from './value.js';
/** @schema */
export interface Model {
  value: Value;
  parent?: Model;
}
