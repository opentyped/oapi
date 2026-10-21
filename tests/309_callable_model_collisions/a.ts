export interface User {
  /** @minLength 2 */
  name: string;
  children: User[];
}
export declare function load(): User;
