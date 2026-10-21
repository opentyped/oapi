import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';
import type { EmptyResponse } from '@typedapi/openapi';

declare const app: Router;
enum Priority {
  Low,
  Normal,
  High = 1 << 3,
  Negative = -2,
}
const priority = Priority.High;
interface Ping {
  responses: { 204: EmptyResponse };
}
oapi.mount<Ping>(app, {
  method: 'GET',
  path: '/ping',
  operationId: 'ping',
  extensions: {
    'x-priority': priority,
    'x-indexed': Priority['High'],
    'x-levels': [Priority.Low, Priority.Normal, Priority.High],
    'x-details': { offset: Priority.Negative },
  },
  handler(_request, response) {
    response.status(204).end();
  },
});
