import type { ExpressHandler } from '@typedapi/express';

interface Read {
  params: { id: string };
  responses: { 200: { body: { id: string } } };
}
/** @route GET /users/{id} */
// prettier-ignore
export const getUser: ((ExpressHandler<Read>)) = (request, response) => {
  response.json({ id: request.params.id });
};
