interface Value {
  id: string;
}
interface Direct {
  [key: `item.${string}.end`]: Value;
}

/** @schema */
export interface Model {
  direct: Direct;
  literal: { [key: `literal-${string}`]: Value };
}
