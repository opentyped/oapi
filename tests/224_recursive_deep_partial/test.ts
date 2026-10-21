interface User {
  /** @minLength 2 */
  name: string;
  manager?: User;
  children: User[];
}
type DeepPartial<T> = T extends readonly (infer Item)[]
  ? DeepPartial<Item>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;
/** @schema */
export type Model = DeepPartial<User>;
