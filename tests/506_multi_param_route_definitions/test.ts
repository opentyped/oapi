/** @route GET /orgs/{org}/repos/{repo} */
export interface ReadRepo {
  params: { org: string; repo: string };
  responses: { 200: { body: { fullName: string } } };
}
