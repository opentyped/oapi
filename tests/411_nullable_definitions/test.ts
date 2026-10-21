/** @schema */
export interface Model {
  /** @nullable */
  flag: string;
  /** @nullable */
  tags: string[];
  explicit: string | null;
  nested: { inner: number | null };
}
