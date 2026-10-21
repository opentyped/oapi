interface Value {
  id: string;
}
interface Direct {
  kind: 'dictionary';
  [key: `item.${string}.end`]: Value;
}
/** @schema */
export interface Model {
  direct: Direct;
  items: Record<`item-${string}`, Value>;
  events: Record<`event-${string}`, Value>;
  literal: { [key: `literal-${string}`]: Value };
  token: `item.${string}.end`;
}
