/** @route PATCH /items/{id} */
export interface PatchItem {
  params: { id: string };
  body: { title?: string };
  responses: { 200: { body: { id: string; title: string } } };
}
