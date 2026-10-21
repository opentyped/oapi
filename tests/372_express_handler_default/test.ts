import type { ExpressHandler } from '@typedapi/express';
import type { HttpContract } from '@typedapi/openapi';
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

type Named<Extra extends HttpContract, C extends HttpContract = Extra> = ExpressHandler<C>;

/**
 * @route GET /events/{id}
 * @operationId readEvent
 */
export const readEvent: Named<ReadEvent> = (_request, response) => {
  response.json({ id: 'event' });
};
