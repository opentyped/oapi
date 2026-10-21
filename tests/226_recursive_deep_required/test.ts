interface User {
  /** @minLength 2 */
  name?: string;
  children?: User[];
}
type DeepRequired<T> = T extends readonly (infer Item)[]
  ? DeepRequired<Item>[]
  : T extends object
    ? { [K in keyof T]-?: DeepRequired<NonNullable<T[K]>> }
    : T;
/** @schema */
export type Model = DeepRequired<User>;
