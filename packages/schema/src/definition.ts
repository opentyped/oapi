import type ts from 'typescript';
import type { SchemaEntry } from '@opentyped/oapi-openapi/schema/resource';

export type Schema = boolean | { [key: string]: unknown };

export interface SchemaRoot {
  name: string;
  type: ts.Type;
  node: ts.Node;
  /** Compile a private entry slot without renaming the referenced declaration. */
  alias?: boolean;
}

export interface TypeMapping {
  match: { module: string; export: string };
  /** JSON representation of this exported type; no runtime conversion is performed. */
  schema: Schema;
}

export interface SchemaOptions {
  /** Base directory for automatic, module-qualified schema names. */
  root: string;
  /** Relative file globs mapped to namespace prefixes; the most-specific static base wins. */
  namespaces?: Readonly<Record<string, string>>;
  /** The document compiler validates the complete program after rendering declarations. */
  deferDiagnostics?: boolean;
  /** Maximum number of distinct type instantiations. Prevents expanding generics forever. */
  maxTypes?: number;
  typeMappings?: readonly TypeMapping[];
  types?: { any?: 'error' | 'allow'; unknown?: 'error' | 'allow' };
  /** Shared declaration naming supplied by a document compiler. */
  name?: (node: ts.Node) => string | undefined;
  /** Shared source namespace supplied by a document compiler, including composed projects. */
  namespace?: (node: ts.Node) => string | undefined;
  /** Reserve generated specializations without renaming explicit roots. */
  generatedName?: (preferred: string) => string;
}

export interface SchemaDestination {
  /** Schema-position path containing generated definitions in the owning document. */
  path: readonly string[];
  baseUri?: string;
  /** Other schema positions already registered in the same document. */
  entries?: readonly SchemaEntry[];
  /** Document regions assembled later; the owning document must validate them after composition. */
  pending?: readonly (readonly string[])[];
}

export interface SchemaCompilation {
  definitions: Record<string, Schema>;
  roots: ReadonlyMap<SchemaRoot, Schema>;
}

export interface SchemaDocument {
  $schema: 'https://json-schema.org/draft/2020-12/schema';
  $defs: Record<string, Schema>;
}
