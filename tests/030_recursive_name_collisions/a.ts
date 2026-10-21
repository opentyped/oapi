export interface User {
  id: string;
  peers: Readonly<Record<string, User>>;
}
