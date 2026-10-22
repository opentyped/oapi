import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';
import { webHandler } from '@opentyped/oapi-openapi/contract';
import type { EmptyResponse, StreamRequest } from '@opentyped/oapi-openapi';
interface UploadItem {
  /** @minLength 2 */
  id: string;
  parent?: UploadItem;
}
/** @route POST /events */
export interface Upload {
  /** Upload an encoded sequence of items. */
  requestBody: StreamRequest<UploadItem>;
  responses: { 204: EmptyResponse };
}
/** @route POST /optional-events */
export interface OptionalUpload {
  requestBody?: StreamRequest<UploadItem, 'application/x-ndjson'>;
  responses: { 204: EmptyResponse };
}

declare const app: Router;
oapi.mount<Upload>(app, {
  method: 'POST',
  path: '/express-events',
  operationId: 'ExpressUpload',
  handler(request, response) {
    void request.body;
    request.on('end', () => response.status(204).end());
    request.resume();
  },
});
/** @route POST /web-events */
export const webUpload = webHandler<Upload>(async (request) => {
  await request.text();
  return { status: 204 };
});

/** @route POST /batch-events */
export interface BatchUpload {
  requestBody: StreamRequest<UploadItem> & {
    /**
     * @minItems 1
     * @maxItems 3
     */
    body: UploadItem[];
  };
  responses: { 204: EmptyResponse };
}
