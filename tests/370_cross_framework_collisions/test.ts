import express from 'express';
import oapi from '@typedapi/express';
import type { Endpoint } from '@typedapi/express';
import { webHandler } from '@typedapi/openapi/contract';
import type { User as Admin } from './a.js';
import type { User as Customer } from './b.js';

interface ConvertUser {
  body: Admin;
  responses: { 200: { body: Customer } };
}
export const app = express();
app.use(express.json());
const endpoint: Endpoint<ConvertUser> = {
  method: 'POST',
  path: '/users',
  operationId: 'convertUser',
  handler(request, response) {
    response.json({ id: Number(request.body.id), peers: {} });
  },
};
oapi.mount<ConvertUser>(app, endpoint);

/**
 * @route POST /web/users
 * @operationId convertWebUser
 */
export const web = webHandler<ConvertUser>(() => ({
  status: 200,
  body: { id: 1, peers: {} },
}));
