/** @schema */
export interface constructor {
  id: string;
  next?: constructor;
}

/** @schema */
export interface toString {
  value: number;
}

/** @schema */
export interface __proto__ {
  enabled: boolean;
}

/** @schema */
export interface Model {
  first: constructor;
  second: toString;
  third: __proto__;
}
