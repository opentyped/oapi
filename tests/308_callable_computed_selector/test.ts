import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

declare const app: Router;
interface Model {
  /** @minLength 2 */
  name: string;
  children: Model[];
}
export declare function compute(): Model;
interface Selected<
  F extends (...args: never[]) => Model,
  K extends keyof ReturnType<F> = keyof ReturnType<F>,
> {
  body: { value: ReturnType<F>[K] };
}
interface Contract<F extends (...args: never[]) => Model> extends Selected<F> {
  responses: { 200: { body: Model } };
}
oapi.mount<Contract<typeof compute>>(app, {
  method: 'POST',
  path: '/selected-fields',
  operationId: 'selectedFields',
  handler(_request, response) {
    return response.json({ name: 'ok', children: [] });
  },
});
