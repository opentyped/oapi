interface User {
  /** @minLength 2 */
  name: string;
  manager?: User;
}
interface Missing {
  code: 'missing';
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Matching selects the model.
type Selected<T> = T extends `item_${infer Name}` ? User : Missing;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- A distinct alias exercises generic Array syntax without reusing the first result.
type MatrixItem<T> = T extends `item_${infer Name}` ? User : Missing;
type Suffix<T> = T extends `item_${infer Name}` ? Name : 'invalid';
type OptionalSuffix<T> = T extends `item_${infer Name}` ? Name : 'invalid';
interface Envelope<T> {
  /** @minItems 1 */
  items: Selected<T>[];
  names: readonly Suffix<T>[];
  matrix: Array<ReadonlyArray<MatrixItem<T>>>;
  optional?: ReadonlyArray<OptionalSuffix<T>>;
}
/** @schema */
export type Result = Envelope<'item_ada'>;

/** @minItems 2 */
type RootArray<T> = MatrixItem<T>[];
/** @schema */
export type ArrayResult = RootArray<'item_root'>;

/** @minItems 1 */
type FrozenArray<T> = Readonly<MatrixItem<T>[]>;
/** @schema */
export type FrozenResult = FrozenArray<'item_frozen'>;
