interface Payload {
  id: string;
}

/** @schema */
export interface Model {
  __proto__: Payload;
  constructor?: string;
  hasOwnProperty?: boolean;
  __typedapi_proto__?: string;
}

interface Base {
  __proto__: string;
}

/** @schema */
export interface Extended extends Base {
  id: number;
}
