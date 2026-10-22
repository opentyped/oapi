import type { EmptyResponse } from '@opentyped/oapi-openapi';
export interface Model {
  id: string;
  parent?: Model;
}
export interface Read {
  params: { id: string };
  query: { expand?: boolean };
  responses: { 200: { body: Model }; 404: EmptyResponse };
}
