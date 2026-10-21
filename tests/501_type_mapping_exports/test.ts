import type Opaque from './wire.js';
import type { Wrapped } from './barrel.js';

/** @schema */
export type Mapped = Opaque<{ hidden: unknown }>;

/** @schema */
export interface Model {
  item: Opaque<unknown>;
  reexported: Wrapped<unknown>;
  dictionary: Record<string, Opaque<unknown>>;
  list: Array<Opaque<unknown>>;
  /** @minLength 2 */
  constrained: Opaque<unknown>;
}
