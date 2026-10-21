import type { EmptyResponse } from '@typedapi/openapi';

interface User {
  id: string;
  parent?: User;
}
/** @route GET /health */
export interface Health {
  responses: { 204: EmptyResponse };
}
/** @route GET /users/{id} */
export interface ReadUser {
  params: { id: string };
  responses: { 200: { body: User } };
}
