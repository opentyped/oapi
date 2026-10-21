/** @minLength 2 */
type Code = string;
interface Input {
  id: string;
  next?: Input;
}
export declare function query(input: Input, code?: Code, ...flags: boolean[]): void;
export declare class Factory {
  constructor(input: Input, count?: number);
}
/** @schema */
export interface Model {
  arguments: Parameters<typeof query>;
  empty: Parameters<() => void>;
  constructorArguments: ConstructorParameters<typeof Factory>;
}
