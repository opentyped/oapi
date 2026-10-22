import type { ExpressHandler } from '@opentyped/oapi-express';
import type { HttpContract } from '@opentyped/oapi-openapi';
import type { EmptyResponse } from '@opentyped/oapi-openapi';

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
type Route<C extends HttpContract> = Named<{ responses: { 204: EmptyResponse } }, C>;
type Concrete = Route<ReadEvent>;

/**
 * @route GET /events/{id}
 * @operationId readEvent
 */
export const readEvent: Concrete = (_request, response) => {
  response.json({ id: 'event' });
};
