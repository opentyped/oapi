import { webHandler } from '@typedapi/openapi/contract';

interface Heartbeat {
  sequence: number;
  previous?: Heartbeat;
}
interface Poll {
  responses: { 200: { body?: Heartbeat } };
}

/**
 * @route GET /heartbeat
 * @operationId pollHeartbeat
 */
export const poll = webHandler<Poll>((request) =>
  request.headers.has('x-empty') ? { status: 200 } : { status: 200, body: { sequence: 1 } },
);
