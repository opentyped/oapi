import { webHandler } from '@typedapi/openapi/contract';

interface Read {
  responses: {
    200: { body: { ok: true } };
    404: { body: { notFound: true } };
    '4XX': { body: { clientError: string } };
    default: { body: { unexpected: string } };
  };
}

/**
 * @route GET /status
 * @operationId readStatus
 */
export const read = webHandler<Read>((request) => {
  if (request.headers.has('x-missing')) return { status: 404, body: { notFound: true } };
  if (request.headers.has('x-limited')) return { status: 429, body: { clientError: 'Slow down' } };
  if (request.headers.has('x-failed')) return { status: 503, body: { unexpected: 'Unavailable' } };
  return { status: 200, body: { ok: true } };
});
