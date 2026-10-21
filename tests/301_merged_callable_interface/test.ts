import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';

declare const app: Router;
interface Input {
  /** @minLength 2 */
  code: string;
  next?: Input;
}
interface Output {
  label: string;
  children?: Output[];
}
export declare function compute(input: Input): Output;
interface Endpoint<F extends (...args: never[]) => unknown> {
  body: Parameters<F>[0];
}
interface Endpoint<F extends (...args: never[]) => unknown = typeof compute> {
  responses: { 200: { body: ReturnType<F> } };
}
oapi.mount<Endpoint>(app, {
  method: 'POST',
  path: '/merged',
  operationId: 'mergedEndpoint',
  handler(request, response) {
    return response.json({ label: request.body.code });
  },
});
