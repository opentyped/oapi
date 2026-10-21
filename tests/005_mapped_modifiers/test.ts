/** @schema */
export type Model = { readonly [K in 'name' | 'age']-?: K extends 'name' ? string : number };
