import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';

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
interface RequestPart<F extends (...args: never[]) => unknown> {
  body: Parameters<F>[0];
}
interface ResponsePart<F extends (...args: never[]) => unknown> {
  responses: { 200: { body: ReturnType<F> } };
}
interface Parts<F extends (...args: never[]) => unknown> extends RequestPart<F>, ResponsePart<F> {}
interface Endpoint<F extends (...args: never[]) => unknown> extends Parts<F> {
  query?: { mode?: 'full' | 'compact' };
}
oapi.mount<Endpoint<typeof compute>>(app, {
  method: 'POST',
  path: '/inherited',
  operationId: 'inheritedEndpoint',
  handler(request, response) {
    return response.json({ label: request.body.code });
  },
});
