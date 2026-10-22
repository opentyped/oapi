import type { StreamResponse } from '@opentyped/openapi';

/** @route POST /documents */
export interface WriteXml {
  requestBody: { content: { 'application/xml': string } };
  responses: { 200: { content: { 'application/xml': string } } };
}

/** @route PUT /files/{name} */
export interface Upload {
  params: { name: string };
  requestBody: { content: { 'application/octet-stream': string } };
  responses: { 200: { content: { 'application/octet-stream': string } } };
}

/** @route POST /forms */
export interface SubmitForm {
  requestBody: { content: { 'multipart/form-data': { name: string } } };
  responses: { 200: { body: { name: string } } };
}

/** @route GET /events */
export interface Events {
  responses: { 200: StreamResponse<{ id: string }, 'text/event-stream'> };
}
