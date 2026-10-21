import type ts from 'typescript';
import { localReference } from '~/pointer';
import { resolveRef } from '~/resolve';
import { scanDiscriminators } from '~/discriminate';
import type { DiscriminatorIndex } from '~/discriminate';
import type { Document } from '~/types';

/** Mutable state shared by every transform during one generation run. */
export interface Context {
  /** Canonical URI of the source document, when assigned. */
  documentUri?: string;
  /** Emit readonly properties and readonly arrays. */
  immutable: boolean;
  /** Alphabetize object members. */
  alphabetize: boolean;
  /** Stable alias name per extracted schema definition, by `#/`-reference. */
  schemaAliases: Map<string, string>;
  /** Source path per operation id, for duplicate detection. */
  operationDefinitions: Map<string, string>;
  /** Extra declarations emitted after the root interfaces. */
  injectFooter: ts.Node[];
  /** Discriminator index precomputed from the document. */
  discriminators: DiscriminatorIndex;
  /** Resolve a local reference against the source document. */
  resolve<T>(ref: string): T | undefined;
}

export interface ContextOptions {
  immutable?: boolean;
  alphabetize?: boolean;
}

/** Build the shared context; scans discriminators, which may patch the document. */
export function createContext(document: Document, options: ContextOptions = {}): Context {
  const schemaAliases = new Map<string, string>();
  // Polymorphic component schemas get stable aliases so member references
  // stay readable instead of inlining the full union.
  for (const [name, schema] of Object.entries(document.components?.schemas ?? {})) {
    if (
      schema &&
      typeof schema === 'object' &&
      ('anyOf' in schema || 'oneOf' in schema || Array.isArray(schema.type))
    ) {
      schemaAliases.set(
        `#/components/schemas/${name}`,
        `$Schema_${Buffer.from(name).toString('hex')}`,
      );
    }
  }
  return {
    documentUri: document.$self,
    immutable: options.immutable ?? false,
    alphabetize: options.alphabetize ?? true,
    schemaAliases,
    operationDefinitions: new Map(),
    injectFooter: [],
    discriminators: scanDiscriminators(document),
    resolve<T>(ref: string): T | undefined {
      return resolveRef<T>(document, localReference(ref, document.$self));
    },
  };
}
