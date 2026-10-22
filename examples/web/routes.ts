import { webHandler } from '@opentyped/oapi-openapi/contract';

interface Echo {
  body: { name: string };
  responses: {
    200: { body: { greeting: string } };
    400: { body: { message: string } };
  };
}

/** @route POST /echo */
export const echo = webHandler<Echo>(async (request) => {
  const body = await request.json(); // unknown: validate untrusted input yourself.
  if (
    !body ||
    typeof body !== 'object' ||
    !('name' in body) ||
    typeof body.name !== 'string' ||
    Object.keys(body).some((key) => key !== 'name')
  )
    return { status: 400, body: { message: 'Expected a name' } };
  return { status: 200, body: { greeting: `Hello, ${body.name}` } };
});
