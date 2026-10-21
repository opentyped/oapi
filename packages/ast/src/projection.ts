import ts from 'typescript';
import { isTupleTypeReference } from 'ts-api-utils';
import { ConstantJson } from '~/json';
import { unwrapNoInfer } from '~/navigation';

/** Matches projected syntax to checked property, collection and literal-tag types. */
export class TypeProjection {
  constructor(
    private readonly checker: ts.TypeChecker,
    private readonly symbol: (node: ts.TypeReferenceNode) => ts.Symbol | undefined,
    private readonly projections: WeakMap<ts.TypeLiteralNode, ts.Type>,
  ) {}

  private matchesTags(node: ts.TypeLiteralNode, type: ts.Type, location: ts.Node): boolean {
    const checker = this.checker;
    const constants = new ConstantJson(checker, location);
    return node.members.every((member) => {
      if (
        !ts.isPropertySignature(member) ||
        member.questionToken ||
        !member.type ||
        !ts.isLiteralTypeNode(member.type) ||
        ts.isComputedPropertyName(member.name)
      )
        return true;
      const property = checker.getPropertyOfType(type, member.name.text);
      if (!property || property.flags & ts.SymbolFlags.Optional) return false;
      const actual = checker.typeToTypeNode(
        checker.getTypeOfSymbolAtLocation(property, location),
        location,
        ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.InTypeAlias,
      );
      return (
        !!actual &&
        ts.isLiteralTypeNode(actual) &&
        constants.read(actual.literal) === constants.read(member.type.literal)
      );
    });
  }

  bind(node: ts.TypeNode, input: ts.Type, location: ts.Node): void {
    const checker = this.checker;
    let visited = 0;
    const bind = (part: ts.TypeNode, input: ts.Type, depth = 0): void => {
      if (++visited > 10000 || depth > 100)
        throw new Error('Callable projection type matching exceeds the traversal budget.');
      const type = checker.getNonNullableType(unwrapNoInfer(input));
      const next = (node: ts.TypeNode, type: ts.Type | undefined): void => {
        if (type) bind(node, type, depth + 1);
      };
      if (
        ts.isParenthesizedTypeNode(part) ||
        ts.isOptionalTypeNode(part) ||
        ts.isTypeOperatorNode(part)
      )
        return next(part.type, type);
      if (ts.isUnionTypeNode(part)) {
        part.types.forEach((member) => next(member, type));
        return;
      }
      const owner = ts.isTypeReferenceNode(part) ? this.symbol(part) : undefined;
      if (type.isUnion()) {
        const matches = type.types.filter((candidate) => {
          if (ts.isArrayTypeNode(part)) return checker.isArrayType(candidate);
          if (ts.isTupleTypeNode(part)) return checker.isTupleType(candidate);
          if (owner) return candidate.aliasSymbol === owner || candidate.getSymbol() === owner;
          return (
            ts.isTypeLiteralNode(part) &&
            !!(candidate.flags & ts.TypeFlags.Object) &&
            !checker.isArrayType(candidate) &&
            !checker.isTupleType(candidate) &&
            !candidate
              .getSymbol()
              ?.declarations?.some(
                (declaration) =>
                  ts.isInterfaceDeclaration(declaration) || ts.isClassDeclaration(declaration),
              ) &&
            this.matchesTags(part, candidate, location)
          );
        });
        if (matches.length === 1) next(part, matches[0]);
        return;
      }
      if (ts.isTypeLiteralNode(part) && type.flags & ts.TypeFlags.Object) {
        this.projections.set(part, type);
        const indexes = checker.getIndexInfosOfType(type);
        const value = indexes[0]?.type;
        for (const member of part.members) {
          if (
            ts.isIndexSignatureDeclaration(member) &&
            value &&
            indexes.every((index) => index.type === value)
          )
            next(member.type, value);
          if (
            !ts.isPropertySignature(member) ||
            !member.type ||
            ts.isComputedPropertyName(member.name)
          )
            continue;
          const property = checker.getPropertyOfType(type, member.name.text);
          if (property) next(member.type, checker.getTypeOfSymbolAtLocation(property, location));
        }
        return;
      }
      if (ts.isArrayTypeNode(part)) return next(part.elementType, type.getNumberIndexType());
      if (ts.isTupleTypeNode(part) && isTupleTypeReference(type)) {
        const arguments_ = checker.getTypeArguments(type);
        part.elements.forEach((element, index) => {
          const member =
            ts.isNamedTupleMember(element) || ts.isRestTypeNode(element) ? element.type : element;
          const rest =
            ts.isRestTypeNode(element) ||
            (ts.isNamedTupleMember(element) && element.dotDotDotToken);
          next(rest && ts.isArrayTypeNode(member) ? member.elementType : member, arguments_[index]);
        });
        return;
      }
      if (!ts.isTypeReferenceNode(part) || !owner) return;
      const arguments_ =
        type.aliasSymbol === owner
          ? type.aliasTypeArguments
          : type.flags & ts.TypeFlags.Object &&
              (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference &&
              type.getSymbol() === owner
            ? checker.getTypeArguments(type as ts.TypeReference)
            : undefined;
      part.typeArguments?.forEach((argument, index) => next(argument, arguments_?.[index]));
    };
    bind(node, input);
  }
}
