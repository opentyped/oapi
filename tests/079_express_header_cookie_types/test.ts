import oapi from '@opentyped/oapi-express';
import express from 'express';

interface SessionResult {
  trace: string;
  session: string;
  mode: 'fast' | 'slow';
  theme: 'dark' | 'light';
}
interface ReadSession {
  headers: { 'X-Trace': string; 'X-Mode'?: 'fast' | 'slow' };
  cookies: { session: string; theme?: 'dark' | 'light' };
  responses: { 200: { body: SessionResult } };
}

oapi.mount<ReadSession>(express(), {
  method: 'GET',
  path: '/session',
  operationId: 'readSession',
  handler(request, response) {
    response.json({
      trace: request.headers['x-trace'],
      session: request.cookies.session,
      mode: request.headers['x-mode'] ?? 'fast',
      theme: request.cookies.theme ?? 'light',
    });
  },
});
