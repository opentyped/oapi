import type { EmptyResponse } from '@opentyped/oapi-openapi';
/** @schema */
interface Payload {
  id: string;
  children?: Payload[];
}
interface CopyCallback {
  '{$request.body#/callbackUrl}': {
    /** @http {"operationId":"copyCallback"} */
    COPY: { responses: { 204: EmptyResponse } };
  };
}
/** @route PROPFIND /files/{id} */
export interface Inspect {
  params: { id: string };
  body: { callbackUrl: string };
  responses: { 207: { body: Payload } };
  callbacks: { done: CopyCallback };
}
/** @route SEARCH /files */
export interface Find {
  responses: { 200: { body: Payload[] } };
}
/** @route search /files */
export interface CaseFind {
  responses: { 204: EmptyResponse };
}
/** @route GET,COPY /health */
export interface Health {
  responses: { 204: EmptyResponse };
}
