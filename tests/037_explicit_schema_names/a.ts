/** @schemaName admin.User */
export interface User {
  id: string;
  peers: Readonly<Record<string, User>>;
}
