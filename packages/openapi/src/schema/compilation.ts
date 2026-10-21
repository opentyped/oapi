import type { Source } from '~/diagnostic';
import type { Schema, Components } from '~/schema/definition';

export interface CompiledDeclaration {
  name: string;
  source: Source;
  annotations: ReadonlyMap<string, string>;
  additionalTags?: readonly string[];
  emitSchema: boolean;
  emitOperation: boolean;
  emitResponse: boolean;
  schema: Schema;
}
export interface Compilation {
  declarations: CompiledDeclaration[];
  components: Components;
  responses: Record<string, { schema: Schema; source: Source }>;
}
