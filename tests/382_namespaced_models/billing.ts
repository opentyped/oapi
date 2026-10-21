/**
 * @schema
 */
export interface User {
  id: number;
  manager?: User;
}
