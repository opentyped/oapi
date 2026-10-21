interface Model {
  /** @minLength 2 */
  name: string;
  children: Model[];
}
enum Key {
  Name = 'name',
  Children = 'children',
}
enum Numeric {
  Zero = 0,
  One = 1,
}
enum ViewKey {
  Name = 'name',
  Count = 'count',
}
interface Numbers {
  0: Model;
  1: number;
}
interface View {
  /** @minLength 2 */
  name: string;
  count?: number;
}
/** @schema */
export interface Dataset {
  selected: Model[Key];
  numeric: Numbers[Numeric];
  numericLiteral?: Numbers[0 | 1];
  value?: View[ViewKey];
}
