/**
 * @route GET /secured
 * @security [{"local":["read"],"#/components/securitySchemes/local":["read"],"#%2Fcomponents%2FsecuritySchemes%2Flocal":["read"]},{"./local":["external:scope"]},{"https://auth.example.test/schemes/service":["external:scope"]}]
 */
export interface ReadSecured {
  responses: { 204: { body?: never } };
}
