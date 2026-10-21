interface User {
  id: string;
  next?: User;
}
type Indexed<T> = T extends `user_${infer Name}`
  ? { values: { [key: string]: Name }; owner: User }
  : null;
type Recorded<T> = T extends `user_${infer Name}`
  ? { values: Readonly<Record<string, Readonly<Name[]>>>; owner: User }
  : null;
type Wrapped<T> = T extends `user_${infer Name}`
  ? { values: Readonly<{ name: Name }>; owner: User }
  : null;

/** @schema */
export interface Model {
  /** @inline */
  indexed: Indexed<'user_ada' | 'none'>;
  /** @inline */
  recorded: Recorded<'user_bo' | 'none'>;
  /** @inline */
  wrapped: Wrapped<'user_cy' | 'none'>;
}
