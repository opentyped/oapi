interface Holder {
  value: unknown;
  filtered: NonNullable<unknown>;
}
type Deep<T> = T extends object ? { [K in keyof T]: Deep<NonNullable<T[K]>> } : T;

/** @schema */
export type Model = Deep<Holder>;
/** @schema */
export type NonNull = NonNullable<unknown>;
