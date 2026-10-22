import type { EmptyResponse } from '@opentyped/oapi-openapi';

/** @schema */
export interface Widget {
  sku: string;
  /** @nullable */
  retired?: string;
}

/** @route GET /widgets/{sku} */
export interface ReadWidget {
  params: { sku: string };
  responses: {
    200: { body: Widget };
    /** Missing widget. */
    404: EmptyResponse;
  };
}

/** @route GET,COPY /widgets */
export interface ListWidgets {
  responses: {
    200: { body: Widget[] };
    207: EmptyResponse;
  };
}
