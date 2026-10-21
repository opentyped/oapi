import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';

declare const app: Router;
interface Model {
  /** @minLength 2 */
  name: string;
  children: Model[];
}
export declare function compute<
  T extends {
    /** @minLength 2 */
    name: string;
    children: Model[];
  },
>(this: T): void;
type Contract<F extends (...args: never[]) => unknown> = {
  body: { value: ThisParameterType<F>[keyof ThisParameterType<F>] };
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
