interface User {
  id: string;
}
interface Extra {
  active: boolean;
}
interface Detail {
  count: number;
}
interface Box<T> {
  value: T;
}

/** @schema */
export interface Model {
  forward: Box<User & Extra>;
  reverse: Box<Extra & User>;
  nested: { value: User & Extra } & { value: Detail };
}
