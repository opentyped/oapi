interface User {
  /** @minLength 2 */
  name: string;
  manager?: User;
}
interface Missing {
  code: 'missing';
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Matching selects a model.
type Selected<T> = T extends `item_${infer Name}` ? User : Missing;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Distinct aliases keep each dictionary path independently exercised.
type BatchItem<T> = T extends `item_${infer Name}` ? User : Missing;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- The root dictionary has its own instantiation.
type RootItem<T> = T extends `item_${infer Name}` ? User : Missing;
type Suffix<T> = T extends `item_${infer Name}` ? Name : 'invalid';
type OptionalSuffix<T> = T extends `item_${infer Name}` ? Name : 'invalid';
/** @minProperties 1 */
interface Dictionary<T> {
  [key: string]: Selected<T>;
}
interface Envelope<T> {
  models: Dictionary<T>;
  names: Record<string, Suffix<T>>;
  batches: Record<string, BatchItem<T>[]>;
  optional?: Record<string, OptionalSuffix<T>>;
}
/** @schema */
export type Result = Envelope<'item_ada'>;
/** @minProperties 1 */
type RootMap<T> = Record<string, RootItem<T>>;
/** @schema */
export type MapResult = RootMap<'item_root'>;

/** @minProperties 1 */
type FrozenMap<T> = Readonly<Record<string, Selected<T>>>;
/** @schema */
export type FrozenResult = FrozenMap<'item_frozen'>;
