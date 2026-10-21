interface SearchHit {
  page: number;
}
export type Context = SearchHit[];

export enum KnownEndpoints {
  'together.ai' = 'together.ai',
}

interface Result {
  unused: boolean;
}
export type InternalResult = Result;
