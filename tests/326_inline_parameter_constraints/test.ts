import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

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
>(input: T): void;
type Contract<F extends (...args: never[]) => unknown> = {
  body: { value: Parameters<F>[0][keyof Parameters<F>[0]] };
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
