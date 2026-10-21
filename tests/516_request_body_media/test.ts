/** @schema */
export interface User {
  id: string;
  name: string;
}
/** @route GET /users/{id} */
export interface ReadUser {
  params: { id: string };
  headers: { 'X-Tenant': string };
  query: { expand?: 'teams' | 'roles' };
  responses: { 200: { body: User } };
}
/** @route PATCH /users/{id} */
export interface UpdateUser {
  params: { id: string };
  headers: { 'X-Revision': number };
  query: { notify?: boolean };
  requestBody: {
    content: {
      'application/json': { name: string };
      'application/vnd.user+json': { label: string };
      'application/json;profile=short': { short: string };
      'application/json;profile=long': { long: number };
      'application/xml': { display: string };
      'text/plain': string;
      'application/octet-stream': string;
    };
  };
  responses: { 200: { body: User }; 400: { body: { reason: string } } };
}
/** @route POST /users/{id} */
export interface ActivateUser {
  params: { id: number };
  query: { priority: number };
  body: { active: boolean };
  responses: { 200: { body: User } };
}
/** @route PUT /users/{id} */
export interface SetLabel {
  params: { id: string };
  body: string | null;
  responses: { 200: { body: User } };
}
/** @route POST /batch */
export interface CreateBatch {
  body: User[];
  responses: { 200: { body: User[] } };
}
/** @route POST /metadata */
export interface SetMetadata {
  body: { size: number; type: string };
  responses: { 200: { body: User } };
}
