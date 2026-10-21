import type { TypeMapping } from '@typedapi/schema';
import type { DocumentOptions } from '@typedapi/openapi/document/definition';
import type { Selection, Nest } from '@typedapi/openapi/registration';

/** Settings available to a parser; pipeline composition belongs to the caller. */
export interface ParserOptions extends DocumentOptions {
  tsconfig: string;
  root?: string;
  /** Source-file globs relative to root mapped to schema namespace prefixes. */
  namespaces?: Readonly<Record<string, string>>;
  typeMappings?: readonly TypeMapping[];
  include?: Selection;
  nest?: readonly Nest[];
  /** Both default to error. Allow emits an unconstrained schema and a warning. */
  types?: { any?: 'error' | 'allow'; unknown?: 'error' | 'allow' };
}
