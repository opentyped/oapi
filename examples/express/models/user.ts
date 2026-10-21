/** @schema */
export interface User {
  id: string;
  name: string;
  manager?: User;
}
