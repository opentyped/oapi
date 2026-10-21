interface Row {
  /** @format uuid */
  id: string;
  /**
   * Public display name.
   * @minLength 1
   * @maxLength 80
   */
  name: string;
  /**
   * @asType string
   * @pattern ^[0-9]+$
   */
  balance: bigint;
  passwordHash: string;
}

/** @schema */
export interface Model extends Pick<Row, 'id' | 'name' | 'balance'> {
  createdAt: Date;
  homepage?: URL;
}
