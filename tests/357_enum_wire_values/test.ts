enum Status {
  ReadyToShip = 'ready-to-ship',
  Completed = 'completed',
}
interface Model {
  /** @minLength 2 */
  name: string;
  children: Model[];
}
interface Rows {
  'ready-to-ship': Model;
  completed: number;
}

/** @schema */
export interface Dataset {
  status: Status;
  selected: Rows[Status];
  counts: Record<Status, number>;
}
