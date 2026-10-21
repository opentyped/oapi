enum Choice {
  A = 'a',
  B = 'b',
}

/** @schema */
export interface Model {
  role: ('admin' | 'member') & string;
  code: (1 | 2) & number;
  overlap: ('a' | 'b') & ('b' | 'c');
  mixed: ('ok' | 1) & string;
  choice: Choice & ('b' | 'c');
}

/** @schema */
export type Impossible = ('a' | 'b') & number;
