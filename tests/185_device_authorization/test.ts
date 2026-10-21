/**
 * @route GET /devices
 * @security [{"deviceAlias":["read:items"],"clientCert":[]}]
 */
export interface ReadDevices {
  responses: { 204: { body?: never } };
}
