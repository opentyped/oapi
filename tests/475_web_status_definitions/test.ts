import { webHandler } from '@typedapi/openapi/contract';
import type { EmptyResponse } from '@typedapi/openapi';

interface ReadAsset {
  params: { id: string };
  responses: {
    200: { body: { id: string } };
    404: EmptyResponse;
  };
}

/** @route GET /assets/{id} */
export const readAsset = webHandler<ReadAsset>(() => ({ status: 404 }));
