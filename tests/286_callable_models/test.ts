/** @minLength 2 */
type Code = string;
interface Input {
  code: Code;
  next?: Input;
}
export declare function query(this: Input, input: Input): void;
export declare function codeQuery(code: Code): void;
export declare class Factory {
  constructor(value: Input);
}
/** @schema */
export interface Model {
  input: Parameters<typeof query>[0];
  constructed: ConstructorParameters<typeof Factory>[0];
  receiver: ThisParameterType<typeof query>;
  code: Parameters<typeof codeQuery>[0];
}
