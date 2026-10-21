import { webHandler } from '@typedapi/openapi/contract';

interface Input {
  /** @minLength 1 */
  name: string;
}
interface Echo {
  body: Input;
  responses: {
    200: { body: Input };
    400: { body: { message: string } };
  };
}
/** @route POST /echo */
export const echo = webHandler<Echo>(async (request) => {
  const body = await request.clone().json();
  if (
    body &&
    typeof body === 'object' &&
    'name' in body &&
    typeof body.name === 'string' &&
    body.name.length > 0 &&
    Object.keys(body).every((key) => key === 'name')
  )
    return { status: 200, body: { name: body.name } };
  return { status: 400, body: { message: 'Expected a nonempty name' } };
});
