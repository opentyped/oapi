interface Line {
  sku: string;
  quantity: number;
}

/** @schema */
export interface Order {
  id: string;
  lines: Line[];
  /** @nullable */
  note?: string;
  totals: { sub: number; tax?: number; tags: string[] };
}
