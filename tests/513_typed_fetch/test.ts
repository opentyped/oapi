import type { EmptyResponse } from '@opentyped/oapi-openapi';
/** @schema */
export interface User {
  id: string;
  name: string;
}
/** @route POST /users */
export interface CreateUser {
  headers: { 'X-Trace': string };
  cookies: { session: string };
  body: { name: string };
  responses: { 201: { body: User }; 400: { body: { message: string } } };
}
/** @route GET /users */
export interface ListUsers {
  query: { limit?: number };
  responses: { 200: { body: User[] } };
}
/** @route QUERY /users */
export interface QueryUsers {
  body: { name: string };
  responses: { 200: { body: User[] } };
}
/** @route COPY /users/{id} */
export interface CopyUser {
  params: { id: string };
  responses: { 204: EmptyResponse };
}
