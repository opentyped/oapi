/** @schema */
export type Model = (Record<`a-${string}`, string> | Record<`b-${string}`, number>) & {
  kind: 'dictionary';
};
