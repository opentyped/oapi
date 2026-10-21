interface Table<T> {
  read: T;
  write: Partial<T>;
}
interface Row {
  /** @minLength 2 */
  name: string;
  parent?: Row;
}
export declare const table: Table<Row>;
type Keys = 'read' | 'write';
/** @schema */
export type Model = (typeof table)[Keys];
