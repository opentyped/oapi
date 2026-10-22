import type { Parser } from '~/parser/parser';
import type { ParserOptions } from '~/parser/options';
import type { DocumentModifier } from '@opentyped/oapi-openapi/document/modifier';
import type { Schema, SchemaExport } from '@opentyped/oapi-openapi/schema/definition';
import type { OpenApiDocument } from '@opentyped/oapi-openapi/document/definition';
export type { TypeMapping } from '@opentyped/oapi-schema';
export type { Schema } from '@opentyped/oapi-openapi/schema/definition';
export type { Operation, OpenApiDocument } from '@opentyped/oapi-openapi/document/definition';

export interface ProjectDocument {
  options: GenerateOptions;
  path?: string;
  operationIdPrefix?: string;
  /** Append tags to path and webhook operations in this document. */
  tags?: readonly string[];
}

export interface GenerateOptions extends Omit<ParserOptions, 'info'> {
  /** Missing title/version use the nearest package.json. Complete info bypasses inference. */
  info?: Partial<ParserOptions['info']>;
  documents?: readonly ProjectDocument[];
  modifiers?: readonly DocumentModifier[];
  /** Replaces defaults and is inherited by composed documents unless they supply parsers. */
  parsers?: readonly Parser[];
}

export interface OutputOptions extends GenerateOptions {
  /** Exact output files, relative to root. No other artifacts are emitted. */
  output: { document: string; declarations: string };
  /** Ambient module prefix. Default: openapi. */
  prefix?: string;
}

export interface Generation {
  document: OpenApiDocument;
  models: SchemaExport[];
  /** A self-contained schema per marked model, with local $defs. */
  schemas: Record<string, Schema>;
  warnings: string[];
  /** Includes imported models and extended tsconfigs for Vite watching. */
  files: string[];
  /** Project roots and include-glob directories needed for discovery of added files. */
  watchRoots?: string[];
}

/** In-memory declaration files rendered before whole-project validation. */
export interface DeclarationRenderer {
  readonly file: string;
  render(generation: Generation): string;
}

export function defineConfig<T extends OutputOptions>(config: T): T {
  return config;
}
