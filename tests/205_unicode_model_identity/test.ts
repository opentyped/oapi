/**
 * @schema
 * @schemaName CafeComposed
 */
export interface Café {
  value: string;
  next?: Café;
}

/**
 * @schema
 * @schemaName CafeDecomposed
 */
export interface Café {
  value: number;
  next?: Café;
}
