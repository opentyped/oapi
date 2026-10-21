import type { load as admin } from './a.js';
import type { load as customer } from './b.js';

type Selected<
  F extends (...args: never[]) => unknown,
  K extends keyof ReturnType<F> = keyof ReturnType<F>,
> = { value: ReturnType<F>[K] };
/** @schema */
export interface Dataset {
  admin: Selected<typeof admin>;
  customer: Selected<typeof customer>;
}
