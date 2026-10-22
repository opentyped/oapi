import { webHandler } from '@opentyped/oapi-openapi/contract';
import type { EmptyResponse } from '@opentyped/oapi-openapi';

interface ReadAsset {
  params: { id: string };
  responses: {
    200: { body: { id: string } };
    404: EmptyResponse;
  };
}

/** @route GET /assets/{id} */
export const readAsset = webHandler<ReadAsset>(() => ({ status: 404 }));
