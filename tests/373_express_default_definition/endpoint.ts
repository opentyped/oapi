import type { Endpoint } from '@opentyped/express';
import route from './contracts.js';
import type { Read } from './contracts.js';
export default {
  method: 'GET',
  path: route,
  operationId: 'readModel',
  handler(req, res) {
    res.json({ id: req.params.id });
  },
} satisfies Endpoint<Read>;
