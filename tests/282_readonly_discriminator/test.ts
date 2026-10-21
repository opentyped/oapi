interface A {
  kind: 'a';
  value: string;
}
interface B {
  kind: 'b';
  value: number;
}
/** @discriminator kind */
type Base = A | B;

/** @schema */
export type Model = Readonly<Base>;
