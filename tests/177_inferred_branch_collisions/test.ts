import type { Select as Left } from './a.js';
import type { Select as Right } from './b.js';

/** @schema */
export interface Model {
  /** @inline */
  left: Left<'user_ada' | 'user_bo'>;
  /** @inline */
  right: Right<'user_ada' | 'user_bo'>;
}
