interface User {
  /** @minLength 2 */
  name: string;
  manager?: User;
  children: User[];
}
type DeepReadonly<T> = T extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;
/** @schema */
export type Model = DeepReadonly<User>;
