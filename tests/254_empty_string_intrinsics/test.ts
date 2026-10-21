/** @schema */
export type Capitalized = Capitalize<''>;

/** @schema */
export type Uncapitalized = Uncapitalize<''>;

/** @schema */
export type Names = { [K in Capitalize<'' | 'word'>]: number };
