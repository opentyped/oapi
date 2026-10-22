import express from 'express';
import oapi from '@opentyped/express';
interface Trace {
  responses: { 200: { body: string; contentType: 'message/http' } };
}
export const app = express();
oapi.mount<Trace>(app, {
  method: 'TRACE',
  path: '/trace',
  operationId: 'trace',
  handler(_request, response) {
    response.type('message/http').send('TRACE /trace HTTP/1.1\r\n\r\n');
  },
});
