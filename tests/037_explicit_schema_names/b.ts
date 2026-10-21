/** @schemaName customer.User */
export interface User {
  id: number;
  peers: Readonly<Record<string, User>>;
}
