/** @schemaName CON */
interface ReservedComponent {
  id: string;
  next?: ReservedComponent;
}
/**
 * @schema
 * @schemaName namespace.CON
 */
export interface Root {
  item: ReservedComponent;
}
