import { webHandler } from '@opentyped/oapi-openapi/contract';

interface Read {
  responses: { 200: { body: { ok: boolean } } };
}
type FetchHandler = (request: Request) => Promise<Response>;

/** @route GET /satisfies */
export const satisfiesHandler = webHandler<Read>(() => ({
  status: 200,
  body: { ok: true },
})) satisfies FetchHandler;

/** @route GET /asserted */
export const assertedHandler = ((webHandler as typeof webHandler)<Read>(() => ({
  status: 200,
  body: { ok: true },
})) as FetchHandler)!;
