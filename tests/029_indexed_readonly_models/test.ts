export const states = ['pending', 'ready', 'failed'] as const;
type State = (typeof states)[number];
interface Fields {
  id: string;
  state: State;
}

/** @schema */
export interface Model {
  readonly id: Fields['id'];
  readonly state: Fields['state'];
  readonly history: readonly State[];
  readonly children: Readonly<Record<string, Model>>;
}
