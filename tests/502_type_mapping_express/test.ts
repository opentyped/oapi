import type { Decimal } from 'decimal.js';
import type { Router } from '@opentyped/oapi-express';
import oapi from '@opentyped/oapi-express';

declare const app: Router;
interface CreatePayment {
  body: { amount: Decimal };
  responses: { 201: { body: { amount: Decimal } } };
}
oapi.mount<CreatePayment>(app, {
  method: 'POST',
  path: '/payments',
  operationId: 'createPayment',
  handler(request, response) {
    response.status(201).json({ amount: request.body.amount });
  },
});
