import { webHandler } from '@typedapi/openapi/contract';
import type { EmptyResponse } from '@typedapi/openapi';

interface EventPayload {
  id: string;
  previous?: EventPayload;
}
interface ReadEvent {
  params: { id: string };
  query: { format?: 'json' | 'text' };
  responses: {
    200: { content: { 'application/json': EventPayload; 'text/plain': string } };
    404: EmptyResponse;
  };
}

const adapters = { create: webHandler };
const create = adapters.create;

/**
 * @route GET /events/{id}
 * @operationId readEvent
 */
export const readEvent = create<ReadEvent>(() => ({
  status: 200,
  contentType: 'application/json',
  body: { id: 'event' },
}));
