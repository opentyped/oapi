import type { EmptyResponse } from '@opentyped/oapi-openapi';

interface CopyPayload {
  callbackUrl: string;
}
interface CopyCallback {
  '{$request.body#/callbackUrl}': {
    /** @http {"operationId": "copyCallback"} */
    COPY: { responses: { 204: EmptyResponse } };
  };
}

/** @route POST /copies */
export interface StartCopy {
  body: CopyPayload;
  responses: { 202: { body: { job: string } } };
  callbacks: { done: CopyCallback };
}
