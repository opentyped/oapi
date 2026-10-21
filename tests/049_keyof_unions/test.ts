interface Left {
  id: string;
  label?: string;
  left: boolean;
}

interface Right {
  id: number;
  label: number;
  right: boolean;
}

/** @schema */
export interface Model {
  shared: keyof (Left | Right);
  combined: keyof (Left & { right: boolean });
  dictionary: keyof (Left | Record<string, number>);
}

/** @schema */
export type DisjointKeys = keyof ({ left: string } | { right: number });
