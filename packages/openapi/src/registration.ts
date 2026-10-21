/** Explicit document membership, analogous to Utoipa's paths and component registration. */
export interface Selection {
  /** Names of annotated operations, or source-relative file.ts#Name identifiers. */
  paths?: readonly string[];
  /** Names of webhook contracts, or source-relative file.ts#Name identifiers. */
  webhooks?: readonly string[];
  /** Additional marked models to emit independently of references from paths. */
  schemas?: readonly string[];
  /** Additional named response envelopes, marked with the response annotation. */
  responses?: readonly string[];
}

/** Nested document membership under an OpenAPI path prefix. */
export interface Nest {
  path: string;
  include: Selection;
  /** Prefix explicit/generated IDs when registering an operation more than once. */
  operationIdPrefix?: string;
  /** Append tags to selected operations; inner groups precede enclosing groups. */
  tags?: readonly string[];
  nest?: readonly Nest[];
}
