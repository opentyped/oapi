import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';

declare const app: Router;

interface Input {
  headers: { 'X-Trace': string; 'X-Mode'?: 'fast' | 'slow' };
  cookies: { session: string; theme?: 'dark' | 'light' };
}
interface Output {
  trace: string;
  theme?: 'dark' | 'light';
}

oapi.mount<Input, Output>(app, {
  method: 'GET',
  path: '/preferences',
  operationId: 'readPreferences',
  handler(request, response) {
    return response.json({
      trace: request.headers['x-trace'],
      theme: request.cookies.theme ?? 'dark',
    });
  },
});
