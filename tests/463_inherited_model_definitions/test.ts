interface Pet {
  name: string;
}

/** @schema */
export interface Dog extends Pet {
  barks: boolean;
}
