import oapi from '@opentyped/express';
import type { EmptyResponse } from '@opentyped/openapi';
import express from 'express';

interface SubscriptionEvent {
  id: string;
  previous?: SubscriptionEvent;
}
interface SubscribeBody {
  callbackUrl: string;
}
interface EventHook {
  '{$request.body#/callbackUrl}': {
    /** @http {"operationId":"deliverEvent","security":[],"servers":[{"url":"https://{tenant}.callbacks.example.test","description":"Delivery endpoint","variables":{"tenant":{"default":"demo","enum":["demo","prod"]}}}]} */
    post: {
      body: SubscriptionEvent;
      responses: { 204: EmptyResponse };
    };
  };
}
interface Subscribe {
  body: SubscribeBody;
  responses: { 202: EmptyResponse };
  callbacks: { onEvent: EventHook };
}

oapi.mount<Subscribe>(express(), {
  method: 'POST',
  path: '/subscriptions',
  operationId: 'subscribe',
  handler(_request, response) {
    response.status(202).end();
  },
});
