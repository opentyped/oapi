import type { EmptyResponse } from '@opentyped/oapi-openapi';
/** @route POST /documents */
export interface WriteXml {
  requestBody: { content: { 'application/xml': string } };
  responses: { 201: { content: { 'application/xml': string } } };
}
/** @route PUT /files/{name} */
export interface UploadFile {
  params: { name: string };
  requestBody: { content: { 'application/octet-stream': string } };
  responses: { 204: EmptyResponse };
}
/** @route GET /files/{name} */
export interface DownloadFile {
  params: { name: string };
  responses: { 200: { content: { 'application/octet-stream': string } } };
}
/** @route GET /events */
export interface ReadEvents {
  responses: { 200: { content: { 'text/event-stream': string } } };
}
/** @route POST /forms */
export interface SubmitForm {
  requestBody: { content: { 'multipart/form-data': { name: string } } };
  responses: { 204: EmptyResponse };
}
