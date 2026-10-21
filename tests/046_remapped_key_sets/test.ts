interface Source {
  id: string;
  count?: number;
}

type Duplicate<T> = { [K in keyof T as K | `copy_${K & string}`]: T[K] };
type Collide<T> = { [K in keyof T as 'value']: T[K] };

/** @schema */
export interface Model {
  /** @inline */
  duplicate: Duplicate<Source>;
  /** @inline */
  collide: Collide<{ id: string; count: number }>;
  /** @inline */
  optionalCollision: Collide<{ count?: number; id: string }>;
}
