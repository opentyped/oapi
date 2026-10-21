import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';
import { read as imported, arrow, typed } from './handlers.js';
import type { Contract } from './handlers.js';
declare const app: Router;
oapi.mount<Contract>(app, {
  method: 'GET',
  path: '/imported',
  operationId: 'imported',
  handler: imported,
});
const handler = arrow;
oapi.mount<Contract>(app, {
  method: 'GET',
  path: '/arrow',
  operationId: 'arrow',
  handler,
});
oapi.mount<Contract>(app, {
  method: 'GET',
  path: '/overridden',
  operationId: 'overridden',
  deprecated: false,
  /** Local summary overrides the imported handler documentation. */
  handler: imported,
});

oapi.mount<Contract>(app, {
  method: 'GET',
  path: '/typed',
  operationId: 'typed',
  handler: typed,
});
