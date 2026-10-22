import { webHandler } from '@opentyped/openapi/contract';

interface ReadText {
  responses: {
    200: { body: string; contentType: 'text/plain; charset=utf-8' };
    404: { body: { message: string }; contentType: 'application/problem+json' };
  };
}

/**
 * @route GET /text
 * @operationId readText
 */
export const read = webHandler<ReadText>((request) =>
  request.headers.has('x-missing')
    ? {
        status: 404,
        contentType: 'application/problem+json',
        body: { message: 'Missing text' },
      }
    : { status: 200, contentType: 'text/plain; charset=utf-8', body: 'Hello' },
);
