import type { Decimal } from 'decimal.js';
import type { Router } from '@opentyped/express';
import oapi from '@opentyped/express';

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
