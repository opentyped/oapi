/** @route POST /files/{id}:export
 * @contextPath /v1:stable
 */
export interface ExportFile {
  params: { id: string };
  responses: { 204: { body?: never } };
}

/** @route GET /clock/12:30 */
export interface ReadClock {
  responses: { 204: { body?: never } };
}

/** @route GET /legacy/:id */
export interface Legacy {
  params: { id: string };
  responses: { 204: { body?: never } };
}
