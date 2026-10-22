import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';

declare const app: Router;
interface Read {
  query: { fail?: string };
  responses: {
    200: { body: { ok: boolean } };
    500: { body: { message: string } };
  };
}
oapi.mount<Read>(app, {
  method: 'GET',
  path: '/async-mount',
  operationId: 'asyncMount',
  async handler(request, response, next) {
    try {
      await Promise.resolve();
      if (request.query.fail === 'yes') throw new Error('failed');
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
});
app.get(
  '/async-handler',
  oapi.handler<Read>({
    operationId: 'asyncHandler',
    async handler(request, response, next) {
      try {
        await Promise.resolve();
        if (request.query.fail === 'yes') throw new Error('failed');
        response.json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  }),
);
