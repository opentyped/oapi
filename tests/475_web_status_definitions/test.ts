import { webHandler } from '@opentyped/openapi/contract';
import type { EmptyResponse } from '@opentyped/openapi';

interface ReadAsset {
  params: { id: string };
  responses: {
    200: { body: { id: string } };
    404: EmptyResponse;
  };
}

/** @route GET /assets/{id} */
export const readAsset = webHandler<ReadAsset>(() => ({ status: 404 }));
