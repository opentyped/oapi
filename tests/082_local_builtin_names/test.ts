import type { Standard } from './standard.js';

type Date = { id: string };
interface Array<T> {
  element: T;
}

/** @schema */
export interface Model {
  date: Date;
  wrapped: Array<string>;
  native: Standard;
}
