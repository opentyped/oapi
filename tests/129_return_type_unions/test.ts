interface User {
  /** @minLength 2 */
  name: string;
  manager?: User;
}
interface Missing {
  /** @const missing */
  error: string;
}
export function lookup(value: User | Missing) {
  return value;
}
export function nullable(value: User | null) {
  return value;
}
export function optional(value: User | undefined) {
  return value;
}
/** @schema */
export interface Results {
  lookup: ReturnType<typeof lookup>;
  nullable: ReturnType<typeof nullable>;
  optional?: ReturnType<typeof optional>;
}
