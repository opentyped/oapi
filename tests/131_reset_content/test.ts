import express from 'express';
import oapi from '@opentyped/express';
import type { EmptyResponse } from '@opentyped/openapi';
import { webHandler } from '@opentyped/openapi/contract';

interface Reset {
  responses: { 205: EmptyResponse };
}
export const app = express();
oapi.mount<Reset>(app, {
  method: 'POST',
  path: '/reset',
  operationId: 'reset',
  handler(_request, response) {
    response.status(205).end();
  },
});
/** @route POST /web-reset */
export const webReset = webHandler<Reset>(() => ({ status: 205 }));

/** @route GET /progress */
export interface Progress {
  responses: { '1XX': EmptyResponse; 200: { body: string } };
}
