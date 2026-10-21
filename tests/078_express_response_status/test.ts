import oapi from '@typedapi/express';
import type { EmptyResponse } from '@typedapi/openapi';
import express from 'express';

interface Problem {
  message: string;
}
interface Health {
  query: { unavailable?: boolean };
  responses: { 204: EmptyResponse; 503: { body: Problem } };
}

express().get(
  '/health',
  oapi.handler<Health>({
    operationId: 'health',
    handler(request, response) {
      if (request.query.unavailable)
        return response.set('Retry-After', '60').status(503).json({ message: 'Unavailable' });
      return response.sendStatus(204);
    },
  }),
);
