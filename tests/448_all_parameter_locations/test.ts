/** @route GET /audits/{id} */
export interface ReadAudit {
  params: { id: string };
  query: { verbose?: boolean };
  headers: { 'X-Auditor': string };
  cookies: { session: string };
  responses: { 200: { body: { id: string } } };
}
