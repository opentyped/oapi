/** @schema */
export interface Model {
  id: string;
  parent?: Model;
  toJSON?: string;
  /** @hidden */
  secret: unknown;
  /** @hidden */
  optionalSecret?: unknown;
  /** @hidden */
  callback: () => void;
  /** @hidden */
  internal: { key: symbol; amount: bigint };
}

export interface Model {
  secret: unknown;
  callback: () => void;
}

/** @schema */
export type Picked = Pick<Model, 'id' | 'secret' | 'optionalSecret'>;

/** @schema */
export type Flags = { [K in keyof Pick<Model, 'id' | 'secret'>]: boolean };
