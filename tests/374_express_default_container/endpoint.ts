import type { Endpoint } from '@opentyped/express';
import type { Read } from './contracts.js';
export default {
  read: {
    method: 'GET',
    path: '/models/:id',
    operationId: 'readModel',
    handler(req, res) {
      res.json({ id: req.params.id });
    },
  } satisfies Endpoint<Read>,
};
