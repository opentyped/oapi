/** @schema */
export interface Settings {
  title: string;
  weights: Record<string, number>;
  labels: { [key: string]: string };
}
