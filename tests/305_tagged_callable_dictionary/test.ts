import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';

declare const app: Router;
interface Output {
  label: string;
  children?: Output[];
}
export declare function compute(input: string): Output;
interface Dictionary<F extends (...args: never[]) => unknown> {
  values:
    | { kind: 'items'; [key: `item_${string}`]: ReturnType<F> }
    | { kind: 'extras'; [key: `extra_${string}`]: ReturnType<F> };
}
interface Contract {
  /** @inline */
  body: Dictionary<typeof compute>;
  responses: { 200: { body: Output } };
}
oapi.mount<Contract>(app, {
  method: 'POST',
  path: '/tagged',
  operationId: 'taggedDictionaryEndpoint',
  handler(request, response) {
    return response.json({ label: request.body.values.kind });
  },
});
