interface Left {
  id: string;
  left: boolean;
}

interface Right {
  id: number;
  right: boolean;
}

type Combined = Left & Right;

interface Internal {
  /** @hidden */
  secret: unknown;
  callback: () => void;
}

/** @schema */
export interface Model {
  conflict: keyof (Left & Right);
  aliased: keyof Combined;
  visible: keyof (Internal & { title: string });
}
