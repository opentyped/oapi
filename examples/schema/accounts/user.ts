/** @schema */
export interface User {
  /** @format uuid */
  id: string;
  /** @minLength 1 */
  name: string;
  roles: ('reader' | 'editor')[];
  manager?: User;
}
