import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';

declare const app: Router;
interface Model {
  /** @minLength 2 */
  name: string;
  children: Model[];
}
export declare function compute(input: Model): void;
type Contract<F extends (...args: never[]) => unknown> = {
  body: { value: Parameters<F>[0]['name'] | Parameters<F>[0]['children'] };
  responses: { 200: { body: Model } };
};
oapi.mount<Contract<typeof compute>>(app, {
  method: 'POST',
  path: '/selected',
  operationId: 'selectedValue',
  handler(_request, response) {
    return response.json({ name: 'ok', children: [] });
  },
});
