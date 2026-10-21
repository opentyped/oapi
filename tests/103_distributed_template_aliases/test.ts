type ItemKey = `item-${string}`;
type OtherKey = `other-${string}`;
type ItemLiteral = 'item-a';
type OtherLiteral = 'other';
type Select<T> = T extends `item-${string}` ? { accepted: T } : { rejected: T };
/** @schema */
export interface Model {
  patterns: Select<ItemKey | OtherKey>;
  literals: Select<ItemLiteral | OtherLiteral>;
}
