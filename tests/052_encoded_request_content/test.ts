import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';
import type { EmptyResponse } from '@typedapi/openapi';

declare const app: Router;

interface Upload {
  /** @format binary */
  file: string;
  tags?: string[];
}

interface Save {
  requestBody: {
    content: {
      /** @http {"encoding":{"file":{"contentType":"application/octet-stream","headers":{"X-Part-Id":{"schema":{"type":"string"},"example":"part-1"}}},"tags":{"style":"form","explode":true}},"x-upload":"attachment"} */
      'multipart/form-data': Upload;
      /** @http {"encoding":{"tags":{"style":"pipeDelimited","explode":false}}} */
      'application/x-www-form-urlencoded': { tags: string[] };
    };
  };
  responses: {
    /** Upload accepted. */
    204: EmptyResponse;
  };
}

oapi.mount<Save>(app, {
  method: 'POST',
  path: '/uploads',
  operationId: 'uploadFile',
  handler(_request, response) {
    response.status(204).end();
  },
});
