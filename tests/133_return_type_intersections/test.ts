interface User {
  /** @minLength 2 */
  name: string;
  manager?: User;
}
interface Tagged {
  /** @maxLength 8 */
  name: string;
  /** @minLength 3 */
  tag: string;
}
export function tagged(value: User & Tagged) {
  return value;
}
/** @schema */
export type Result = ReturnType<typeof tagged>;
