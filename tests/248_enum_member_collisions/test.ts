import type { User as Left } from './left.js';
import type { User as Right } from './right.js';

/** @schema */
export interface Model {
  left: Left;
  right: Right;
  leftMember: Left.Runtime;
  rightMember: Right.Runtime;
  leftCode: Left.Code;
  rightCode: Right.Code;
}
