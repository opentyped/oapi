export interface User {
  /** @minLength 2 */
  name: string;
  manager?: import('./model.js').User;
}
export interface Box<T> {
  value: T;
  next?: Box<T>;
}
export interface Read {
  responses: { 200: { body: User[] } };
}
throw new Error('Imported model module executed');
