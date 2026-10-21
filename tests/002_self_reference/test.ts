/** @schema */
export interface Model {
  id: string;
  next?: Model;
  children: Model[];
}
