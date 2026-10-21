interface Input {
  id: string;
  next?: Input;
}
export declare function query(this: Input, input: Input): void;
export declare class Factory {
  constructor(input: Input);
}
/** @title Argument list */
type Args<F extends (...args: never[]) => unknown> = Parameters<F>;
type Forward<F extends (...args: never[]) => unknown> = Args<F>;
type CtorArgs<C extends abstract new (...args: never[]) => unknown> = ConstructorParameters<C>;
/** @schemaName Receiver */
type ReceiverOf<F> = ThisParameterType<F>;
/** @schema */
export interface Model {
  args: Forward<typeof query>;
  first: Forward<typeof query>[0];
  constructed: CtorArgs<typeof Factory>;
  receiver: ReceiverOf<typeof query>;
}
