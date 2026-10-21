/** @schema */
export interface Model {
  id: string;
  profile: { name: string; address?: { city: string; zip: number } };
  flags: { [key: string]: boolean };
  items: readonly { code: number; labels: string[] }[];
}
