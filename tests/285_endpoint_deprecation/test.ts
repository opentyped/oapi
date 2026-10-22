import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';
import { webHandler } from '@opentyped/openapi/contract';

declare const app: Router;
interface Output {
  ok: boolean;
}
interface Read {
  responses: { 200: { body: Output } };
}
/**
 * @route GET /legacy
 * @deprecated Use Current instead.
 */
export type Legacy = Read;
/**
 * @route GET /current
 * @deprecated false
 */
export type Current = Read;

oapi.mount<Read>(app, {
  method: 'GET',
  path: '/mounted',
  operationId: 'mountedCurrent',
  /** @deprecated false */
  handler(_request, response) {
    return response.json({ ok: true });
  },
});

/**
 * @route GET /web
 * @deprecated false
 */
export const currentWeb = webHandler<Read>(() => ({ status: 200, body: { ok: true } }));
