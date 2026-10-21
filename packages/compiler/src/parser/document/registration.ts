import { tagNames } from '@typedapi/openapi/document/metadata';
import type { ModelDeclaration } from '~/parser/declaration';
import type { Selection, Nest } from '@typedapi/openapi/registration';
import { DeclarationSelection } from '~/parser/document/selection';
import { GenerationError } from '@typedapi/openapi/diagnostic';

/** Composes selected declarations before compilation, so nested documents share one schema graph. */
export class DocumentRegistration {
  private readonly selection: DeclarationSelection;
  constructor(
    private readonly declarations: ModelDeclaration[],
    configPath: string,
  ) {
    this.selection = new DeclarationSelection(declarations, configPath);
  }

  select(include: Selection | undefined, nest: readonly Nest[] | undefined): ModelDeclaration[] {
    const roots =
      include || nest === undefined
        ? this.selection.select(include)
        : this.declarations
            .filter(
              (declaration) =>
                declaration.emitSchema ||
                declaration.emitResponse ||
                declaration.annotations.has('webhook'),
            )
            .map((declaration) => ({
              ...declaration,
              emitOperation: declaration.annotations.has('webhook'),
            }));
    if (nest !== undefined) roots.push(...this.nested(nest, '', '', [], new Set(), { groups: 0 }));
    const schemas = new Set<ModelDeclaration['node']>();
    return roots.map((declaration) => {
      if (!declaration.emitSchema) return declaration;
      if (schemas.has(declaration.node)) return { ...declaration, emitSchema: false };
      schemas.add(declaration.node);
      return declaration;
    });
  }

  private nested(
    groups: readonly Nest[],
    prefix: string,
    idPrefix: string,
    parentTags: readonly string[],
    active: Set<Nest>,
    budget: { groups: number },
  ): ModelDeclaration[] {
    if (!Array.isArray(groups))
      throw new GenerationError('nest must be an array of document registrations.');
    const result: ModelDeclaration[] = [];
    for (const group of groups) {
      if (++budget.groups > 10000)
        throw new GenerationError('Nested document registrations exceed 10000 groups.');
      if (!group || typeof group !== 'object')
        throw new GenerationError('Each nested registration must be an object.');
      if (active.has(group) || active.size >= 100)
        throw new GenerationError('Circular or excessive nested document registrations.');
      if (typeof group.path !== 'string' || !group.path.startsWith('/'))
        throw new GenerationError('Nested document path must start with /.');
      if (!group.include || typeof group.include !== 'object' || Array.isArray(group.include))
        throw new GenerationError('Nested document registration requires an include selection.');
      if (
        group.operationIdPrefix !== undefined &&
        (typeof group.operationIdPrefix !== 'string' || !group.operationIdPrefix.trim())
      )
        throw new GenerationError('Nested operationIdPrefix must be a nonempty string.');
      const tags = [...tagNames(group.tags, 'Nested tags'), ...parentTags];
      const path = prefix + group.path.replace(/\/$/, '');
      const ids = idPrefix + (group.operationIdPrefix ?? '');
      if (path.length > 65536)
        throw new GenerationError('Nested document path exceeds 65536 characters.');
      for (const declaration of this.selection.select(group.include)) {
        const annotations = new Map(declaration.annotations);
        if (declaration.emitOperation) {
          if (!annotations.has('webhook'))
            annotations.set(
              'contextPath',
              path + (annotations.get('contextPath') ?? '').replace(/\/$/, ''),
            );
          if (ids)
            annotations.set(
              'operationId',
              ids + (annotations.get('operationId') ?? declaration.name),
            );
        }
        result.push({
          ...declaration,
          annotations,
          ...(declaration.emitOperation && tags.length
            ? { additionalTags: [...(declaration.additionalTags ?? []), ...tags] }
            : {}),
        });
      }
      if (group.nest)
        result.push(
          ...this.nested(group.nest, path, ids, tags, new Set(active).add(group), budget),
        );
      if (result.length > 10000)
        throw new GenerationError(
          'Nested document registrations expand beyond 10000 declarations.',
        );
    }
    return result;
  }
}
