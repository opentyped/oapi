interface Identity {
  id: string;
}
interface Versioned {
  revision: number;
}

/** @schema */
export interface Model extends Identity {
  name: string;
}

export interface Model extends Versioned {
  /** @minLength 1 */
  category: string;
  parent?: Model;
}
