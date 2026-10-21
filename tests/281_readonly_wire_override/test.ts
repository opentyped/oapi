/** @jsonSchema {"type":"object","additionalProperties":true} */
interface Base {
  [key: string]: unknown;
}

/** @schema */
export type Model = Readonly<Base>;
