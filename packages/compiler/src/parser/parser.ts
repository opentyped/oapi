import type { ParserContext } from '~/parser/context';

export const stages = ['discover', 'register', 'validate', 'schema', 'document'] as const;
export type ParserStage = (typeof stages)[number];

/** A synchronous generation rule. Configuration order is preserved within each stage. */
export interface Parser {
  readonly name: string;
  readonly stage: ParserStage;
  parse(context: ParserContext): void;
}

export type ParserFactory = () => readonly Parser[];

export type { SourceTransform } from '~/parser/transform';
