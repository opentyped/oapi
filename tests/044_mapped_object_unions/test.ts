interface Customer {
  id: string;
  email?: string;
}

interface Service {
  id: string;
  token: string;
}

type Flags<T> = { [K in keyof T]: boolean };

/** @schema */
export interface Model {
  /** @inline */
  flags: Flags<Customer | Service>;
}
