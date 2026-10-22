import { webHandler } from '@opentyped/oapi-openapi/contract';

interface Payload {
  id: string;
}
interface ReadThing {
  params: { id: string };
  responses: { 200: { body: Payload } };
}

/** @route GET /things/{id} */
export const readThing = webHandler<ReadThing>(() => ({
  status: 200,
  body: { id: 'thing' },
}));
