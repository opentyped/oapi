/** @schema */
export type Status = 'draft' | 'active' | 'archived';

/** @schema */
export interface Task {
  id: string;
  status: Status;
}
