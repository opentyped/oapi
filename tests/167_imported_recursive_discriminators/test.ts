import type { Pairs } from './models.js';

/** @route GET /pairs */
export interface ReadPairs {
  responses: { 200: { body: Pairs } };
}
