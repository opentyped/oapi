import ts from 'typescript';
import { templatePattern } from '@opentyped/oapi-ast/pattern';
import type { Schema } from '~/definition';
import { annotate, schemaOverride, overrideResolver } from '~/annotation';
import { SchemaError } from '~/error';
import { queryOrigin } from '~/query';
import { SchemaTuple, tupleItem } from '~/tuple';
import { SchemaCallable } from '~/callable';
import { SchemaProjection } from '~/projection';
import { IndexOrigins } from '~/origin';
import { SchemaIntersection } from '~/intersection';
import type { TypeBindings } from '~/projection';

/** Recover annotation origins; all value types still come from TypeChecker. */
export class SchemaProvenance {
  constructor(
    private readonly checker: ts.TypeChecker,
    private readonly root: string,
    private readonly mapped: (type: ts.Type) => boolean = () => false,
  ) {}

  origin(property: ts.Symbol, node: ts.Node, owner?: ts.Type): ts.Node | undefined {
    if (new SchemaProjection(this.checker, this.root).replacesValue(owner)) return undefined;
    const direct = property.valueDeclaration ?? property.declarations?.[0];
    if (direct) return direct;
    const record = this.recordValue(owner);
    if (record) return record;
    const symbols = this.checker.getRootSymbols(property);
    const roots = [
      ...new Set(
        symbols.flatMap((symbol) => {
          const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
          return declaration ? [declaration] : [];
        }),
      ),
    ];
    const annotated = roots.filter((declaration) => ts.getJSDocTags(declaration).length);
    if (!annotated.length) return undefined;
    const hiddenOnly = annotated.every((declaration) =>
      ts.getJSDocTags(declaration).every((tag) => tag.tagName.text === 'hidden'),
    );
    if (
      roots.length !== 1 ||
      (!hiddenOnly && symbols.some((symbol) => symbol.name !== property.name))
    ) {
      throw new SchemaError(
        'Remapped property has ambiguous annotation origins; provide an explicit model',
        node,
      );
    }
    return annotated[0];
  }

  recordValue(owner?: ts.Type): ts.TypeNode | undefined {
    let symbol = owner?.aliasSymbol;
    const seen = new Set<ts.Symbol>();
    while (symbol && !seen.has(symbol)) {
      seen.add(symbol);
      const declaration = symbol.declarations?.find(ts.isTypeAliasDeclaration);
      if (!declaration) return undefined;
      if (declaration.getSourceFile().hasNoDefaultLib) {
        if (symbol.name === 'Record' && ts.isMappedTypeNode(declaration.type))
          return declaration.type.type;
        if (symbol.name !== 'Readonly') return undefined;
        symbol = owner?.aliasTypeArguments?.[0]?.aliasSymbol;
        continue;
      }
      if (!ts.isTypeReferenceNode(declaration.type)) return undefined;
      symbol = this.checker.getSymbolAtLocation(declaration.type.typeName);
      if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
        symbol = this.checker.getAliasedSymbol(symbol);
    }
    return undefined;
  }

  apply(
    schema: Schema,
    node: ts.Node,
    encode: (type: ts.Type, node: ts.Node, bindings?: TypeBindings) => Schema,
    resolved?: ts.Type,
    owner?: ts.Type,
    inherited?: TypeBindings,
    intersection?: SchemaIntersection,
  ): Schema {
    if (
      owner?.isIntersection() &&
      'name' in node &&
      node.name &&
      ts.isIdentifier(node.name as ts.Node)
    ) {
      const property = this.checker.getPropertyOfType(owner, (node.name as ts.Identifier).text);
      const declarations = [...new Set(property?.declarations ?? [])];
      if (declarations.length > 1) {
        const branches = declarations.map((declaration) =>
          this.apply(schema, declaration, encode, resolved, undefined, inherited, intersection),
        );
        return {
          allOf: branches,
          ...SchemaIntersection.metadata(branches, node),
        };
      }
    }
    const projection = new SchemaProjection(this.checker, this.root);
    const seen = new Set<ts.Node>();
    const expression = (
      value: Schema,
      syntax: ts.TypeNode,
      checked: ts.Type | undefined,
      bindings: TypeBindings,
    ): Schema => {
      if (checked && this.mapped(checked)) return value;
      if (ts.isParenthesizedTypeNode(syntax))
        return expression(value, syntax.type, checked, bindings);
      if (callable.opaque(syntax, bindings)) return value;
      if (ts.isTemplateLiteralTypeNode(syntax) && projection.containsOrigins(syntax, bindings)) {
        const span = syntax.templateSpans[0];
        if (syntax.head.text || syntax.templateSpans.length !== 1 || !span || span.literal.text)
          throw new SchemaError(
            'Annotated template interpolation requires an explicit result model',
            syntax,
          );
        const type = projection.resolved(this.checker.getTypeFromTypeNode(span.type), bindings);
        if (
          !(type.isUnion() ? type.types : [type]).every(
            (part) => part.flags & ts.TypeFlags.StringLike,
          )
        )
          throw new SchemaError(
            'Annotated identity templates require string interpolation',
            syntax,
          );
        return expression(value, span.type, checked, bindings);
      }
      if (ts.isTypeQueryNode(syntax) || (ts.isImportTypeNode(syntax) && syntax.isTypeOf)) {
        const origin = queryOrigin(syntax, this.checker);
        if (origin && !seen.has(syntax)) {
          seen.add(syntax);
          const result = declarationSchema(value, origin, true, checked, bindings);
          seen.delete(syntax);
          return result;
        }
        if (projection.containsOrigins(syntax, bindings))
          throw new SchemaError('Type query requires an explicit annotation origin', syntax);
        return value;
      }
      if (ts.isTypeOperatorNode(syntax)) {
        if (syntax.operator === ts.SyntaxKind.ReadonlyKeyword)
          return expression(value, syntax.type, checked, bindings);
        return projection.keys(syntax, checked, bindings) ?? value;
      }
      if (
        ts.isConditionalTypeNode(syntax) &&
        checked &&
        projection.containsOrigins(syntax, bindings)
      ) {
        const members = checked.isUnion() ? checked.types : [checked];
        return {
          anyOf: members.map((member) => {
            if (member.flags & ts.TypeFlags.Never) return false;
            const candidates = [syntax.trueType, syntax.falseType].filter((branch) =>
              this.checker.isTypeAssignableTo(
                member,
                projection.resolved(this.checker.getTypeFromTypeNode(branch), bindings),
              ),
            );
            if (candidates.length !== 1)
              throw new SchemaError(
                'Conditional annotation origin is ambiguous; provide an explicit result model',
                syntax,
              );
            return expression(encode(member, candidates[0]!), candidates[0]!, member, bindings);
          }),
        };
      }
      if (ts.isUnionTypeNode(syntax) && projection.containsKeys(syntax)) {
        throw new SchemaError(
          'Keyof projection inside a union requires an explicit concrete key model',
          syntax,
        );
      }
      if (
        ts.isUnionTypeNode(syntax) &&
        (projection.containsAnnotations(syntax, bindings) ||
          syntax.types.some(ts.isIndexedAccessTypeNode))
      ) {
        return {
          anyOf: syntax.types.map((part) => {
            const type = projection.resolved(this.checker.getTypeFromTypeNode(part), bindings);
            if (ts.isIndexedAccessTypeNode(part) && type.flags & ts.TypeFlags.IndexedAccess) {
              const unresolved: Schema = {};
              const selected = expression(unresolved, part, undefined, bindings);
              if (selected === unresolved)
                throw new SchemaError('Union indexed value origin cannot be resolved', part);
              return selected;
            }
            return expression(encode(type, part), part, type, bindings);
          }),
        };
      }
      if (ts.isIntersectionTypeNode(syntax)) {
        if (checked && projection.brand(checked, syntax)) {
          const branches = syntax.types.flatMap((part) => {
            const type = projection.resolved(this.checker.getTypeFromTypeNode(part), bindings);
            return projection.scalar(type)
              ? [expression(encode(type, part), part, type, bindings)]
              : [];
          });
          if (!branches.length)
            throw new SchemaError('Primitive brand annotation origin is unresolved', syntax);
          return branches.length === 1 ? branches[0]! : { allOf: branches };
        }
        const projected = projection.intersection(syntax, checked, encode);
        if (!projection.containsAnnotations(syntax, bindings)) return projected ?? value;
        const types = syntax.types.map((part) =>
          projection.resolved(this.checker.getTypeFromTypeNode(part), bindings),
        );
        if (
          checked &&
          projection.scalar(checked) &&
          types.every((type) => projection.scalar(type) || type.flags & ts.TypeFlags.Unknown)
        )
          return {
            allOf: types.map((type, index) => {
              const actual = type.flags & ts.TypeFlags.Unknown ? checked : type;
              return expression(
                encode(actual, syntax.types[index]!),
                syntax.types[index]!,
                actual,
                bindings,
              );
            }),
          };
        // Index generation already merges the complete object before closing its keys.
        // Replay only source metadata against that shape, never closed operand objects.
        if (
          checked &&
          types.every((type) => !!(type.flags & ts.TypeFlags.Object)) &&
          this.checker
            .getIndexInfosOfType(checked)
            .some(
              (index) =>
                index.keyType.flags & ts.TypeFlags.String || templatePattern(index.keyType),
            )
        )
          return syntax.types.reduce(
            (result, part) => expression(result, part, checked, bindings),
            value,
          );
        if (!types.every((type) => projection.scalar(type)))
          throw new SchemaError(
            'Annotated intersection requires preserved operand origins',
            syntax,
          );
        return {
          allOf: types.map((type, index) =>
            expression(encode(type, syntax.types[index]!), syntax.types[index]!, type, bindings),
          ),
        };
      }
      if (ts.isArrayTypeNode(syntax)) return array(value, syntax.elementType, checked, bindings);
      if (
        ts.isTupleTypeNode(syntax) &&
        projection.containsAnnotations(syntax, bindings) &&
        syntax.elements.some(
          (member) =>
            ts.isRestTypeNode(member) || (ts.isNamedTupleMember(member) && member.dotDotDotToken),
        )
      )
        return new SchemaTuple(this.checker, this.root).project(
          syntax,
          bindings,
          (type, source, scope) => expression(encode(type, source), source, type, scope),
        );
      if (ts.isTupleTypeNode(syntax) && projection.containsAnnotations(syntax, bindings)) {
        for (const part of syntax.elements) {
          const rest = ts.isRestTypeNode(part)
            ? part.type
            : ts.isNamedTupleMember(part) && part.dotDotDotToken
              ? part.type
              : undefined;
          if (rest && !ts.isArrayTypeNode(rest))
            throw new SchemaError(
              'Annotated tuple spreads require preserved segment boundaries',
              part,
            );
        }
        if (!checked || !this.checker.isTupleType(checked) || typeof value !== 'object')
          throw new SchemaError(
            'Tuple annotation provenance requires a concrete tuple edge',
            syntax,
          );
        // Named tuples recover item origins when their definition is materialized.
        if ('$ref' in value) return value;
        const types = this.checker.getTypeArguments(checked as ts.TypeReference);
        const flags = (checked as ts.TupleTypeReference).target.elementFlags;
        const prefixItems: Schema[] = [];
        let items: Schema = false;
        syntax.elements.forEach((part, index) => {
          const element = ts.isNamedTupleMember(part)
            ? part.type
            : ts.isOptionalTypeNode(part) || ts.isRestTypeNode(part)
              ? part.type
              : part;
          const type = types[index];
          if (!type) throw new SchemaError('Tuple annotation origin cannot be resolved', part);
          const flag = flags[index] ?? ts.ElementFlags.Required;
          if (flag & (ts.ElementFlags.Rest | ts.ElementFlags.Variadic)) {
            if (!ts.isArrayTypeNode(element))
              throw new SchemaError('Annotated tuple rest requires explicit array syntax', part);
            items = expression(
              encode(type, element.elementType),
              element.elementType,
              type,
              bindings,
            );
          } else {
            const variants =
              type.isUnion() && flag & ts.ElementFlags.Optional
                ? type.types.filter((item) => !(item.flags & ts.TypeFlags.Undefined))
                : [type];
            const schemas = variants.map((item) =>
              expression(encode(item, element), element, item, bindings),
            );
            prefixItems.push(
              tupleItem(
                schemas.length === 1 ? schemas[0]! : { anyOf: schemas },
                ts.isNamedTupleMember(part) ? part : undefined,
              ),
            );
          }
        });
        return { ...value, ...(prefixItems.length ? { prefixItems } : {}), items };
      }

      if (ts.isIndexedAccessTypeNode(syntax)) {
        const selected = callable.selectedType(syntax, bindings);
        if (selected) {
          const source = selected.node ?? syntax;
          return declarationSchema(
            encode(selected.type, source),
            source,
            true,
            selected.type,
            selected.bindings,
          );
        }
        let object = projection.resolved(
          this.checker.getTypeFromTypeNode(syntax.objectType),
          bindings,
        );
        const index = projection.resolved(
          this.checker.getTypeFromTypeNode(syntax.indexType),
          bindings,
        );
        const callableObject = callable.selectedType(syntax.objectType, bindings);
        if (callableObject) {
          object = callableObject.type;
          bindings = callableObject.bindings;
        }
        if (
          ((ts.isTypeOperatorNode(syntax.indexType) &&
            syntax.indexType.operator === ts.SyntaxKind.KeyOfKeyword &&
            this.checker.getTypeFromTypeNode(syntax.indexType.type) ===
              this.checker.getTypeFromTypeNode(syntax.objectType)) ||
            (index.flags & ts.TypeFlags.Index &&
              (index as ts.IndexType).type ===
                this.checker.getTypeFromTypeNode(syntax.objectType))) &&
          !(
            object.flags &
            (ts.TypeFlags.Any |
              ts.TypeFlags.Unknown |
              ts.TypeFlags.TypeParameter |
              ts.TypeFlags.Conditional |
              ts.TypeFlags.IndexedAccess)
          ) &&
          !this.checker.getIndexInfosOfType(object).length
        ) {
          const branches = this.checker.getPropertiesOfType(object).map((property) => {
            const declaration = property.valueDeclaration ?? property.declarations?.[0];
            if (!declaration)
              throw new SchemaError('Indexed value requires a declared property origin', syntax);
            const selected = this.checker.getTypeOfSymbolAtLocation(property, declaration);
            return declarationSchema(
              encode(selected, declaration),
              declaration,
              true,
              selected,
              bindings,
            );
          });
          return !branches.length
            ? false
            : branches.length === 1
              ? branches[0]!
              : { anyOf: branches };
        }
        const keys = index.isUnion() ? index.types : [index];
        if (
          !keys.every(
            (key) =>
              key.isStringLiteral() ||
              key.isNumberLiteral() ||
              key.flags & (ts.TypeFlags.String | ts.TypeFlags.Number),
          )
        ) {
          if (projection.containsOrigins(syntax, bindings))
            throw new SchemaError('Indexed annotation key domain is unresolved', syntax);
          return value;
        }
        const branches = keys.map((key) => {
          if (
            key.isStringLiteral() &&
            key.value === 'length' &&
            (object.isUnion() ? object.types : [object]).every(
              (type) => type.flags & ts.TypeFlags.StringLike,
            )
          )
            return { type: 'number' };
          if (key.flags & (ts.TypeFlags.String | ts.TypeFlags.Number)) {
            const kind =
              key.flags & ts.TypeFlags.Number ? ts.IndexKind.Number : ts.IndexKind.String;
            const index =
              this.checker.getIndexInfoOfType(object, kind) ??
              (kind === ts.IndexKind.Number
                ? this.checker.getIndexInfoOfType(object, ts.IndexKind.String)
                : undefined);
            if (!index)
              throw new SchemaError('Indexed collection value origin cannot be resolved', syntax);
            const elements =
              kind === ts.IndexKind.Number
                ? collectionElements(syntax.objectType, bindings)
                : undefined;
            if (elements?.length) {
              const branches = elements.map((element) => {
                if (element.character) return { type: 'string' };
                const type = projection.resolved(
                  this.checker.getTypeFromTypeNode(element.syntax),
                  element.bindings,
                );
                const schema = expression(
                  encode(type, element.syntax),
                  element.syntax,
                  type,
                  element.bindings,
                );
                return element.node ? annotate(schema, element.node) : schema;
              });
              return branches.length === 1 ? branches[0]! : { anyOf: branches };
            }
            if (
              index.declaration?.getSourceFile().hasNoDefaultLib &&
              index.declaration.type &&
              this.checker.getTypeFromTypeNode(index.declaration.type).flags &
                ts.TypeFlags.TypeParameter
            ) {
              if (literalTuple(syntax.objectType)) return value;
              throw new SchemaError(
                'Indexed collection element annotation origins cannot be resolved',
                syntax,
              );
            }
            const origin =
              index.declaration ??
              this.recordValue(object) ??
              object.getSymbol()?.declarations?.find(ts.isMappedTypeNode)?.type;
            if (!origin)
              throw new SchemaError(
                'Indexed collection requires a declared value annotation origin',
                syntax,
              );
            return declarationSchema(
              index.type === checked ? value : encode(index.type, origin),
              origin,
              true,
              index.type,
              bindings,
            );
          }
          const name = String((key as ts.LiteralType).value);
          const property = this.checker.getPropertyOfType(object, name);
          const declaration = property?.valueDeclaration ?? property?.declarations?.[0];
          if (!declaration) {
            const origins = new IndexOrigins(this.checker, this.root)
              .of(syntax.objectType, bindings)
              .filter((origin) => {
                const domain = projection.resolved(
                  this.checker.getTypeFromTypeNode(origin.key),
                  origin.bindings,
                );
                return (domain.isUnion() ? domain.types : [domain]).some((part) => {
                  const pattern = templatePattern(part);
                  return (
                    part.flags & ts.TypeFlags.String ||
                    (part.isLiteral() && String(part.value) === name) ||
                    (part.flags & ts.TypeFlags.Number && String(Number(name)) === name) ||
                    (pattern !== undefined && new RegExp(pattern).test(name))
                  );
                });
              });
            if (origins.length) {
              if (!intersection)
                throw new SchemaError('Indexed value intersection context is unavailable', syntax);
              return origins.reduce<Schema>((result, origin) => {
                const type = projection.resolved(
                  this.checker.getTypeAtLocation(origin.value),
                  origin.bindings,
                );
                const encoded = encode(type, origin.value, origin.bindings);
                const serialized = schemaOverride(
                  origin.value,
                  this.checker,
                  new Set(),
                  undefined,
                  overrideResolver(this.checker, origin.bindings),
                );
                const projected =
                  serialized !== undefined
                    ? encoded
                    : declarationSchema(encoded, origin.value, true, type, origin.bindings);
                return intersection.apply(result, projected, syntax);
              }, true);
            }
            const collections = (object.isUnion() ? object.types : [object]).every(
              (type) =>
                this.checker.isArrayType(type) ||
                this.checker.isTupleType(type) ||
                type.flags & ts.TypeFlags.StringLike ||
                (type.getSymbol()?.name === 'ReadonlyArray' &&
                  type
                    .getSymbol()
                    ?.declarations?.every((node) => node.getSourceFile().hasNoDefaultLib)),
            );
            if (collections && property && name === 'length')
              return encode(
                this.checker.getTypeOfSymbolAtLocation(property, syntax),
                syntax.indexType,
              );
            if (
              collections &&
              (key.isNumberLiteral() || (key.isStringLiteral() && String(Number(name)) === name))
            ) {
              const elements = collectionElements(
                syntax.objectType,
                bindings,
                new Set(),
                Number(name),
              );
              if (elements?.length) {
                const schemas = elements.map((element) => {
                  if (element.character) return { type: 'string' };
                  const type = projection.resolved(
                    this.checker.getTypeFromTypeNode(element.syntax),
                    element.bindings,
                  );
                  const schema = expression(
                    encode(type, element.syntax),
                    element.syntax,
                    type,
                    element.bindings,
                  );
                  return element.node ? annotate(schema, element.node) : schema;
                });
                return schemas.length === 1 ? schemas[0]! : { anyOf: schemas };
              }
            }
            throw new SchemaError(`Indexed annotation origin '${name}' cannot be resolved`, syntax);
          }
          if (!property)
            throw new SchemaError(`Indexed annotation origin '${name}' cannot be resolved`, syntax);
          const selected = this.checker.getTypeOfSymbolAtLocation(property, declaration);
          return declarationSchema(
            selected === checked ? value : encode(selected, declaration),
            declaration,
            true,
            selected,
            bindings,
          );
        });
        return branches.length === 1 ? branches[0]! : { anyOf: branches };
      }
      if (
        ts.isMappedTypeNode(syntax) &&
        !syntax.nameType &&
        checked &&
        this.checker
          .getIndexInfosOfType(this.checker.getTypeFromTypeNode(syntax))
          .some(
            (index) => index.keyType.flags & ts.TypeFlags.String || templatePattern(index.keyType),
          ) &&
        (!syntax.type || !projection.containsOrigins(syntax.type, bindings))
      )
        return value;
      if (!(ts.isTypeReferenceNode(syntax) || ts.isImportTypeNode(syntax))) {
        if (projection.containsOrigins(syntax, bindings))
          throw new SchemaError('Type syntax requires preserved annotation origins', syntax);
        return value;
      }
      const argumentOrigin = bindings.origins?.get(this.checker.getTypeFromTypeNode(syntax));
      if (argumentOrigin)
        return expression(value, argumentOrigin.syntax, checked, argumentOrigin.bindings);
      let symbol = this.checker.getSymbolAtLocation(
        ts.isTypeReferenceNode(syntax) ? syntax.typeName : (syntax.qualifier ?? syntax),
      );
      if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
        symbol = this.checker.getAliasedSymbol(symbol);
      const declaration = symbol?.declarations?.find(
        (item) =>
          ts.isTypeAliasDeclaration(item) ||
          ts.isInterfaceDeclaration(item) ||
          ts.isClassDeclaration(item),
      );
      if (!declaration) return value;
      if (declaration.getSourceFile().hasNoDefaultLib) {
        if (
          ['Parameters', 'ConstructorParameters'].includes(symbol?.name ?? '') &&
          syntax.typeArguments?.[0] &&
          checked
        )
          return callable.parameters(
            syntax,
            checked,
            bindings,
            symbol?.name === 'ConstructorParameters'
              ? ts.SignatureKind.Construct
              : ts.SignatureKind.Call,
          );
        if (symbol?.name === 'ThisParameterType' && syntax.typeArguments?.[0] && checked)
          return callable.receiver(syntax.typeArguments[0], checked, bindings);
        if (symbol?.name === 'ReturnType' && syntax.typeArguments?.[0] && checked)
          return callable.returnType(value, syntax.typeArguments[0], checked, bindings);
        if (symbol?.name === 'Awaited' && syntax.typeArguments?.[0] && checked)
          return callable.awaited(value, syntax.typeArguments[0], checked, bindings);
        if (
          ['Exclude', 'Extract', 'NonNullable'].includes(symbol?.name ?? '') &&
          syntax.typeArguments?.[0] &&
          checked &&
          projection.containsAnnotations(syntax.typeArguments[0], bindings)
        ) {
          const members = checked.isUnion() ? checked.types : [checked];
          const branches = members.map((member) =>
            retained(syntax.typeArguments![0]!, member, bindings),
          );
          if (branches.some((branch) => branch === undefined))
            throw new SchemaError(
              'Utility result has no unambiguous retained annotation origin',
              syntax,
            );
          return branches.length === 1 ? branches[0]! : { anyOf: branches as Schema[] };
        }
        if (
          symbol?.name === 'Record' &&
          syntax.typeArguments?.[1] &&
          checked &&
          (checked.flags & ts.TypeFlags.Object || checked.isIntersection())
        ) {
          // Index key and value origins belong to SchemaIndexes, including scoped bounds.
          if (
            this.checker
              .getIndexInfosOfType(checked)
              .some(
                (index) =>
                  index.keyType.flags & ts.TypeFlags.String || templatePattern(index.keyType),
              )
          )
            return value;
          const element = syntax.typeArguments[1];
          const key = syntax.typeArguments[0];
          if (key && projection.containsOrigins(key, bindings)) {
            const keyType = projection.resolved(this.checker.getTypeFromTypeNode(key), bindings);
            if (
              !(keyType.isUnion() ? keyType.types : [keyType]).every(
                (part) => part.flags & ts.TypeFlags.StringLike,
              )
            )
              throw new SchemaError('Annotated Record keys require a string key domain', key);
            const keys = expression({ type: 'string' }, key, keyType, bindings);
            value = {
              ...(typeof value === 'object' ? value : { allOf: [value] }),
              propertyNames:
                typeof value === 'object' && value.propertyNames !== undefined
                  ? { allOf: [value.propertyNames, keys] }
                  : keys,
            };
          }
          if (!projection.containsOrigins(element, bindings)) return value;
          const properties = Object.create(null) as Record<string, Schema>;
          for (const property of this.checker.getPropertiesOfType(checked)) {
            const type = this.checker.getTypeOfSymbolAtLocation(property, syntax);
            properties[property.name] = expression(encode(type, element), element, type, bindings);
          }
          const index = this.checker
            .getIndexInfosOfType(checked)
            .find((item) => item.keyType.flags & ts.TypeFlags.String);
          return {
            ...(typeof value === 'object' ? value : { allOf: [value] }),
            properties,
            ...(index
              ? {
                  additionalProperties: expression(
                    encode(index.type, element),
                    element,
                    index.type,
                    bindings,
                  ),
                }
              : {}),
          };
        }
        if (
          (symbol?.name === 'Array' || symbol?.name === 'ReadonlyArray') &&
          syntax.typeArguments?.[0]
        ) {
          return array(value, syntax.typeArguments[0], checked, bindings);
        }
        if (symbol?.name === 'NoInfer' && syntax.typeArguments?.[0]) {
          const actual =
            checked && checked.flags & ts.TypeFlags.Substitution
              ? (checked as ts.SubstitutionType).baseType
              : checked;
          return expression(value, syntax.typeArguments[0], actual, bindings);
        }
        if (
          ['Readonly', 'Partial', 'Required', 'Pick', 'Omit'].includes(symbol?.name ?? '') &&
          syntax.typeArguments?.[0]
        ) {
          return expression(value, syntax.typeArguments[0], checked, bindings);
        }
        if (projection.containsOrigins(syntax, bindings))
          throw new SchemaError(
            `Annotations through ${symbol?.name ?? 'this utility'} require an explicit result model`,
            syntax,
          );
        return value;
      }
      if (
        typeof value === 'object' &&
        typeof value.$ref === 'string' &&
        (checked?.getSymbol() === symbol || checked?.aliasSymbol === symbol)
      )
        return value;
      return declarationSchema(
        value,
        declaration,
        false,
        checked,
        projection.bind(syntax, declaration, bindings),
      );
    };
    const literalTuple = (syntax: ts.TypeNode): boolean => {
      if (ts.isParenthesizedTypeNode(syntax)) return literalTuple(syntax.type);
      if (!(ts.isTypeQueryNode(syntax) || (ts.isImportTypeNode(syntax) && syntax.isTypeOf)))
        return false;
      let symbol = this.checker.getSymbolAtLocation(
        ts.isTypeQueryNode(syntax) ? syntax.exprName : (syntax.qualifier ?? syntax),
      );
      if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
        symbol = this.checker.getAliasedSymbol(symbol);
      const declaration = symbol?.valueDeclaration;
      if (
        !declaration ||
        !ts.isVariableDeclaration(declaration) ||
        declaration.type ||
        !declaration.initializer
      )
        return false;
      let expression = declaration.initializer;
      while (
        ts.isParenthesizedExpression(expression) ||
        (ts.isAsExpression(expression) &&
          ts.isTypeReferenceNode(expression.type) &&
          ts.isIdentifier(expression.type.typeName) &&
          expression.type.typeName.text === 'const')
      )
        expression = expression.expression;
      return (
        ts.isArrayLiteralExpression(expression) &&
        expression.elements.every(
          (item) =>
            ts.isStringLiteral(item) ||
            ts.isNumericLiteral(item) ||
            [
              ts.SyntaxKind.TrueKeyword,
              ts.SyntaxKind.FalseKeyword,
              ts.SyntaxKind.NullKeyword,
            ].includes(item.kind),
        )
      );
    };
    const collectionElements = (
      syntax: ts.TypeNode,
      bindings: TypeBindings,
      active = new Set<ts.Node>(),
      position?: number,
    ):
      | { syntax: ts.TypeNode; bindings: TypeBindings; node?: ts.Node; character?: boolean }[]
      | undefined => {
      if (active.has(syntax))
        throw new SchemaError('Indexed collection annotation origins are recursive', syntax);
      active.add(syntax);
      try {
        const type = projection.resolved(this.checker.getTypeFromTypeNode(syntax), bindings);
        if (
          (type.isUnion() ? type.types : [type]).every(
            (part) => part.flags & ts.TypeFlags.StringLike,
          )
        )
          return [{ syntax, bindings, character: true }];
        if (ts.isTypeQueryNode(syntax) || (ts.isImportTypeNode(syntax) && syntax.isTypeOf)) {
          const source = queryOrigin(syntax, this.checker);
          const type = source && (ts.isTypeNode(source) ? source : source.type);
          return type ? collectionElements(type, bindings, active, position) : undefined;
        }
        const origin = bindings.origins?.get(this.checker.getTypeFromTypeNode(syntax));
        if (origin) return collectionElements(origin.syntax, origin.bindings, active, position);
        if (
          ts.isParenthesizedTypeNode(syntax) ||
          (ts.isTypeOperatorNode(syntax) && syntax.operator === ts.SyntaxKind.ReadonlyKeyword)
        )
          return collectionElements(syntax.type, bindings, active, position);
        if (ts.isArrayTypeNode(syntax)) return [{ syntax: syntax.elementType, bindings }];
        if (ts.isUnionTypeNode(syntax)) {
          const choices = syntax.types.map((part) =>
            collectionElements(part, bindings, active, position),
          );
          return choices.every((choice) => choice !== undefined)
            ? choices.flatMap((choice) => choice!)
            : undefined;
        }
        if (ts.isTupleTypeNode(syntax)) {
          if (position !== undefined && (!Number.isSafeInteger(position) || position < 0))
            throw new SchemaError('Indexed tuple position must be a nonnegative integer', syntax);
          let offset = 0;
          let variable = false;
          return syntax.elements.flatMap((element) => {
            const rest =
              ts.isRestTypeNode(element) ||
              (ts.isNamedTupleMember(element) && element.dotDotDotToken);
            const type =
              ts.isRestTypeNode(element) ||
              ts.isNamedTupleMember(element) ||
              ts.isOptionalTypeNode(element)
                ? element.type
                : element;
            if (!rest) {
              const include =
                position === undefined || (variable ? position >= offset : position === offset);
              offset++;
              return include ? [{ syntax: type, bindings }] : [];
            }
            const resolved = projection.resolved(this.checker.getTypeFromTypeNode(type), bindings);
            if (this.checker.isTupleType(resolved)) {
              const tuple = resolved as ts.TupleTypeReference;
              if (
                position !== undefined &&
                tuple.target.elementFlags.some((flag) => flag !== ts.ElementFlags.Required)
              )
                throw new SchemaError(
                  'Indexed tuple spread requires fixed required element origins',
                  element,
                );
              const count = this.checker.getTypeArguments(tuple).length;
              const positions =
                position === undefined
                  ? [undefined]
                  : variable
                    ? Array.from(
                        { length: Math.min(count, Math.max(0, position - offset + 1)) },
                        (_, index) => index,
                      )
                    : position >= offset && position < offset + count
                      ? [position - offset]
                      : [];
              offset += count;
              return positions.flatMap((index) => {
                const source = collectionElements(type, bindings, active, index);
                if (!source)
                  throw new SchemaError(
                    'Indexed tuple spread annotation origin cannot be resolved',
                    element,
                  );
                return source;
              });
            }
            if (!(
              this.checker.isArrayType(resolved) || resolved.getSymbol()?.name === 'ReadonlyArray'
            ))
              throw new SchemaError(
                'Indexed tuple rest annotation origin cannot be resolved',
                element,
              );
            const include = position === undefined || position >= offset;
            variable = true;
            if (!include) return [];
            const source = collectionElements(type, bindings, active);
            if (!source)
              throw new SchemaError(
                'Indexed tuple rest annotation origin cannot be resolved',
                element,
              );
            return source;
          });
        }
        if (!(ts.isTypeReferenceNode(syntax) || ts.isImportTypeNode(syntax))) return undefined;
        let symbol = this.checker.getSymbolAtLocation(
          ts.isTypeReferenceNode(syntax) ? syntax.typeName : (syntax.qualifier ?? syntax),
        );
        if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
          symbol = this.checker.getAliasedSymbol(symbol);
        const declaration = symbol?.declarations?.[0];
        if (declaration?.getSourceFile().hasNoDefaultLib) {
          if (['Array', 'ReadonlyArray'].includes(symbol?.name ?? '') && syntax.typeArguments?.[0])
            return [{ syntax: syntax.typeArguments[0], bindings }];
          if (
            ['Parameters', 'ConstructorParameters'].includes(symbol?.name ?? '') &&
            syntax.typeArguments?.[0]
          ) {
            const source = callable.resolve(
              syntax.typeArguments[0],
              bindings,
              symbol?.name === 'ConstructorParameters'
                ? ts.SignatureKind.Construct
                : ts.SignatureKind.Call,
            );
            return source.signature.parameters.flatMap((parameter, index) => {
              const declaration = parameter.valueDeclaration ?? parameter.declarations?.[0];
              if (!declaration || !ts.isParameter(declaration) || !declaration.type)
                throw new SchemaError(
                  'Indexed parameter requires an explicit parameter type',
                  syntax,
                );
              if (declaration.dotDotDotToken) {
                if (position !== undefined && position < index) return [];
                const origins = collectionElements(
                  declaration.type,
                  source.bindings,
                  active,
                  position === undefined ? undefined : position - index,
                );
                if (!origins)
                  throw new SchemaError(
                    'Indexed rest parameter origin cannot be resolved',
                    declaration,
                  );
                return origins;
              }
              return position === undefined || position === index
                ? [{ syntax: declaration.type, bindings: source.bindings, node: declaration }]
                : [];
            });
          }
          if (symbol?.name === 'ReturnType' && syntax.typeArguments?.[0]) {
            const source = callable.resolve(syntax.typeArguments[0], bindings);
            const declaration = source.signature.getDeclaration();
            return declaration?.type
              ? collectionElements(declaration.type, source.bindings, active, position)
              : undefined;
          }
          return undefined;
        }
        if (!declaration || !ts.isTypeAliasDeclaration(declaration)) return undefined;
        return collectionElements(
          declaration.type,
          projection.bind(syntax, declaration, bindings),
          active,
          position,
        );
      } finally {
        active.delete(syntax);
      }
    };
    const callable = new SchemaCallable(this.checker, encode, expression, this.root);
    const retained = (
      syntax: ts.TypeNode,
      actual: ts.Type,
      bindings: TypeBindings,
      active = new Set<ts.Node>(),
    ): Schema | undefined => {
      if (actual.flags & ts.TypeFlags.Never) return false;
      const source = projection.resolved(this.checker.getTypeFromTypeNode(syntax), bindings);
      if (
        source.flags &
        (ts.TypeFlags.TypeParameter | ts.TypeFlags.Conditional | ts.TypeFlags.IndexedAccess)
      )
        throw new SchemaError('Retained utility annotation source is unresolved', syntax);
      if (!this.checker.isTypeAssignableTo(actual, source)) return undefined;
      if (active.has(syntax)) return encode(actual, syntax);
      active.add(syntax);
      try {
        if (ts.isParenthesizedTypeNode(syntax))
          return retained(syntax.type, actual, bindings, active);
        if (ts.isUnionTypeNode(syntax)) {
          const branches = syntax.types
            .map((part) => retained(part, actual, bindings, active))
            .filter((branch): branch is Schema => branch !== undefined);
          return !branches.length
            ? undefined
            : branches.length === 1
              ? branches[0]!
              : { anyOf: branches };
        }
        if (ts.isTypeReferenceNode(syntax) || ts.isImportTypeNode(syntax)) {
          const origin = bindings.origins?.get(this.checker.getTypeFromTypeNode(syntax));
          if (origin) return retained(origin.syntax, actual, origin.bindings, active);
          let symbol = this.checker.getSymbolAtLocation(
            ts.isTypeReferenceNode(syntax) ? syntax.typeName : (syntax.qualifier ?? syntax),
          );
          if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
            symbol = this.checker.getAliasedSymbol(symbol);
          const declaration = symbol?.declarations?.find(ts.isTypeAliasDeclaration);
          if (declaration && !declaration.getSourceFile().hasNoDefaultLib) {
            const value = retained(
              declaration.type,
              actual,
              projection.bind(syntax, declaration, bindings),
              active,
            );
            return value === undefined ? undefined : annotate(value, declaration);
          }
        }
        return expression(encode(actual, syntax), syntax, actual, bindings);
      } finally {
        active.delete(syntax);
      }
    };
    const array = (
      value: Schema,
      element: ts.TypeNode,
      checked: ts.Type | undefined,
      bindings: TypeBindings,
    ): Schema => {
      if (!projection.containsKeys(element) && !projection.containsAnnotations(element, bindings))
        return value;
      if (checked?.isUnion()) {
        const values = checked.types.filter((type) => !(type.flags & ts.TypeFlags.Undefined));
        if (values.length === 1) checked = values[0];
      }
      if (
        !checked ||
        !(checked.flags & ts.TypeFlags.Object) ||
        !((checked as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference)
      )
        return value;
      const item = this.checker.getTypeArguments(checked as ts.TypeReference)[0];
      if (!item) return value;
      const schema = encode(item, element);
      const projected = expression(schema, element, item, bindings);
      return JSON.stringify(schema) === JSON.stringify(projected)
        ? value
        : projection.containsAnnotations(element, bindings)
          ? { type: 'array', items: projected }
          : { type: 'array', allOf: [value], items: projected };
    };
    const declarationSchema = (
      value: Schema,
      declaration: ts.Node,
      projected = false,
      checked = resolved,
      bindings: TypeBindings = Object.assign(
        new Map([...projection.bindings(owner ?? resolved), ...(inherited ?? [])]),
        { origins: inherited?.origins },
      ),
    ): Schema => {
      if (seen.has(declaration)) return value;
      seen.add(declaration);
      if (
        ts
          .getJSDocTags(declaration)
          .some((tag) => tag.tagName.text === 'jsonSchema' || tag.tagName.text === 'asType')
      ) {
        return annotate(value, declaration, projected);
      }
      if (ts.isTypeNode(declaration)) value = expression(value, declaration, checked, bindings);
      if (
        ts.isTypeAliasDeclaration(declaration) ||
        ts.isPropertySignature(declaration) ||
        ts.isPropertyDeclaration(declaration) ||
        ts.isParameter(declaration) ||
        ts.isVariableDeclaration(declaration) ||
        ts.isIndexSignatureDeclaration(declaration)
      ) {
        if (declaration.type) value = expression(value, declaration.type, checked, bindings);
      }
      seen.delete(declaration);
      return annotate(value, declaration, projected);
    };
    return declarationSchema(schema, node);
  }
}
