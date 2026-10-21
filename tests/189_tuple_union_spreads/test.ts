type Choice = [count: number] | [enabled: boolean, label: string];
type WithChoice<T extends unknown[]> = [start: 'start', ...choice: T, end: 'end'];

/** @schema */
export interface Model {
  named: WithChoice<Choice>;
  unnamed: ['start', ...Choice, 'end'];
}
