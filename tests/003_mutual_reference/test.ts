/** @schema */
export interface User {
  id: string;
  team?: Team;
}
interface Team {
  name: string;
  members: User[];
}
