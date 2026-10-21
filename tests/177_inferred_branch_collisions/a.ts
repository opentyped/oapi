export interface User {
  id: string;
  parent?: User;
}
export type Select<T> = T extends `user_${infer Name}`
  ? {
      /** @minLength 2 */
      name: Name;
      copy?: Name;
      entity: User;
      kind: 'a';
    }
  : null;
