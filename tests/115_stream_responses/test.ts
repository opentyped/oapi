import express from 'express';
import oapi from '@opentyped/oapi-express';
import { webHandler } from '@opentyped/oapi-openapi/contract';
import type { StreamResponse } from '@opentyped/oapi-openapi';

/** @example {"id":"one"} */
interface StreamEvent {
  id: string;
  next?: StreamEvent;
}
/**
 * @response
 * @http {"description":"Event stream"}
 */
type EventStream = StreamResponse<StreamEvent>;
interface ReadEvents {
  responses: { 200: EventStream };
}
const app = express();
oapi.mount<ReadEvents>(app, {
  method: 'GET',
  path: '/events',
  operationId: 'expressEvents',
  handler(_request, response) {
    response.set('Content-Type', 'application/jsonl');
    response.write(JSON.stringify({ id: 'express' } satisfies StreamEvent) + '\n');
    response.end();
  },
});

/** @route GET /web-events */
export const events = webHandler<ReadEvents>(() => ({
  status: 200,
  contentType: 'application/jsonl',
  body: new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"id":"fetch"}\n'));
      controller.close();
    },
  }),
}));

interface BoundedEvents {
  responses: {
    200: {
      /** @maxItems 2 */
      body: StreamEvent[];
      itemSchema: StreamEvent;
      contentType: 'application/jsonl';
    };
  };
}
oapi.mount<BoundedEvents>(app, {
  method: 'GET',
  path: '/bounded-events',
  operationId: 'boundedEvents',
  handler(_request, response) {
    response.set('Content-Type', 'application/jsonl');
    response.write('{"id":"bounded"}\n');
    response.end();
  },
});
