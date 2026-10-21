interface LeftValue {
  left: string;
}
interface RightValue {
  right: number;
}
/** @schema */
export type Model = { value: LeftValue } & { value: RightValue };

/**
 * @schema
 * @schemaName Intersection.59540d04cf66fea6
 */
export interface Existing {
  existing: boolean;
}
