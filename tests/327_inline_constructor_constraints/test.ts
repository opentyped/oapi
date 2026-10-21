import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';

declare const app: Router;
interface Model {
  /** @minLength 2 */
  name: string;
  children: Model[];
}
export declare class Factory<
  T extends {
    /** @minLength 2 */
    name: string;
    children: Model[];
  },
> {
  constructor(input: T);
}
type Contract<F extends abstract new (...args: never[]) => unknown> = {
  body: { value: ConstructorParameters<F>[0][keyof ConstructorParameters<F>[0]] };
  responses: { 200: { body: Model } };
};
oapi.mount<Contract<typeof Factory>>(app, {
  method: 'POST',
  path: '/selected',
  operationId: 'selectedValue',
  handler(_request, response) {
    return response.json({ name: 'ok', children: [] });
  },
});
