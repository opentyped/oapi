export interface User {
  /** @minLength 5 */
  name: string;
  children: User[];
}
export declare function load(): User;
