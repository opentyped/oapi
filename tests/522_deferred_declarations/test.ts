// This consumer imports declarations that do not exist during source discovery.
import './consumer.js';
/** @schema */
export interface User {
  id: string;
}
/** @route GET /users/{id} */
export interface GetUser {
  params: { id: string };
  responses: { 200: { body: User } };
}
/** @route POST /documents */
export interface WriteDocument {
  requestBody: { content: { 'application/xml': string } };
  responses: { 200: { content: { 'application/xml': string } } };
}
