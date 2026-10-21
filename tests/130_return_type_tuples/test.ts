interface User {
  /** @minLength 2 */
  name: string;
  manager?: User;
}
interface Missing {
  /** @const missing */
  error: string;
}
export function fixed(value: readonly [user: User, missing?: Missing]) {
  return value;
}
export function rest(value: [User, ...Missing[]]) {
  return value;
}
/** @schema */
export interface Results {
  fixed: ReturnType<typeof fixed>;
  rest: ReturnType<typeof rest>;
}
