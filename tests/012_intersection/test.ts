/** @schema */
export type Model = { id: string } & {
  nested: { enabled: boolean };
  status: 'active' | 'inactive';
};
