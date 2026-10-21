interface Address {
  street: string;
}
/** @schema */
export interface User {
  id: string;
  address: Address;
  manager?: User;
}
