interface User {
  /** @minLength 2 */
  id: string;
  manager?: User;
}
/** @minLength 3 */
type Label = string;
export function query(): Promise<User> {
  throw new Error('Generation must never call application functions.');
}
export declare function overloaded(name: string): User;
export declare function overloaded(id: number): User[];
export declare function label(): Label;
export function inferred() {
  return { id: 'example' } as User;
}
export async function inferredAsync() {
  return inferred();
}
export function inferredList() {
  return [inferred()];
}
type Callable<T> = () => T;
export declare function generic<T>(): T;

/** @schema */
export interface Result {
  direct: ReturnType<() => User>;
  async: Awaited<ReturnType<typeof query>>;
  list: ReturnType<typeof overloaded>;
  label: ReturnType<typeof label>;
  inferred: ReturnType<typeof inferred>;
  inferredAsync: Awaited<ReturnType<typeof inferredAsync>>;
  inferredList: ReturnType<typeof inferredList>;
  callable: ReturnType<Callable<User>>;
  instantiated: ReturnType<typeof generic<User>>;
}
