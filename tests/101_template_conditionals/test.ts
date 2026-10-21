/** @maxLength 2 */
type Rejected = string;
type Select<T> = T extends `item-${string}` ? { accepted: T } : { rejected: T };
/** @schema */
export interface Model {
  rejected: 'other' extends `item-${string}` ? true : false;
  accepted: 'item-a' extends `item-${string}` ? true : false;
  escaped: 'itemXa' extends `item.${string}` ? true : false;
  composite: 'other' extends `item-${string}` ? { yes: true } : { no: false };
  annotated: 'other' extends `item-${string}` ? number : Rejected;
  distributed: Select<'item-a' | 'other'>;
}
