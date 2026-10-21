/** @schema */
export interface User {
  id: string;
  manager?: User;
}
