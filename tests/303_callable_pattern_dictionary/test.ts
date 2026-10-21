import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';

declare const app: Router;
interface Output {
  label: string;
  children?: Output[];
}
export declare function compute(input: string): Output;
interface Dictionary<F extends (...args: never[]) => unknown> {
  [key: `item_${string}`]: ReturnType<F>;
}
interface Contract {
  /** @inline */
  body: Dictionary<typeof compute>;
  responses: { 200: { body: Output } };
}
oapi.mount<Contract>(app, {
  method: 'POST',
  path: '/patterned',
  operationId: 'patternDictionaryEndpoint',
  handler(request, response) {
    return response.json({ label: Object.keys(request.body).join(',') });
  },
});
