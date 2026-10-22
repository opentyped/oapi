import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

declare const app: Router;
declare const enabled: boolean;
const events: string[] = [];
interface Output {
  ok: boolean;
}
interface Read {
  responses: { 200: { body: Output } };
}
function factory() {
  events.push('factory');
  return oapi;
}
function optional(): typeof oapi | undefined {
  events.push('optional');
  return enabled ? oapi : undefined;
}
const getter = {
  get mount() {
    events.push('getter');
    return oapi.mount;
  },
};
factory().mount<Read>(app, {
  method: 'GET',
  path: '/factory',
  operationId: 'factoryMount',
  handler(_request, response) {
    response.json({ ok: true });
  },
});
optional()?.mount<Read>(app, {
  method: 'GET',
  path: '/optional',
  operationId: 'optionalMount',
  handler(_request, response) {
    response.json({ ok: true });
  },
});
getter.mount<Read>(app, {
  method: 'GET',
  path: '/getter',
  operationId: 'getterMount',
  handler(_request, response) {
    response.json({ ok: true });
  },
});
