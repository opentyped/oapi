import type { Handler } from '@typedapi/express';
import type { EmptyResponse } from '@typedapi/openapi';
export interface Contract {
  responses: { 204: EmptyResponse };
}
type Arguments = Parameters<Handler<Contract>['handler']>;
/**
 * Read through an imported function.
 *
 * Function details remain available through an import alias.
 * @deprecated Prefer the arrow handler.
 */
export function read(...[, response]: Arguments) {
  return response.status(204).end();
}
/**
 * Read through an arrow function.
 *
 * Arrow details remain available through a const alias.
 */
export const arrow = (...[, response]: Arguments) => response.status(204).end();

/** Explicitly typed arrow documentation. */
export const typed: Handler<Contract>['handler'] = (_request, response) =>
  response.status(204).end();
