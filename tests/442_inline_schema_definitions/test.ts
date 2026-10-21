interface Detail {
  code: number;
  label: string;
}

/** @schema */
export interface Summary {
  id: string;
  /** @inline */
  detail: Detail;
}
