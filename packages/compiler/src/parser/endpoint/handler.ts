import ts from 'typescript';
import { annotationsOf } from '~/parser/annotation';
import { fail } from '@typedapi/ast/diagnostic';
import { aliasTarget, unwrapExpression, unwrapType } from '@typedapi/ast/navigation';

/** Recognizes contract-bearing adapters by the resolved declaration, including import aliases. */
function contractArgument(
  expression: ts.Node,
  arguments_: readonly ts.TypeNode[] | undefined,
  checker: ts.TypeChecker,
): ts.TypeNode | undefined {
  let symbol = checker.getSymbolAtLocation(expression);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  const signature = ts.isCallExpression(expression)
    ? checker.getResolvedSignature(expression)?.declaration
    : undefined;
  const declarations = ts.isCallExpression(expression)
    ? signature && [signature]
    : symbol?.declarations;
  const marked = declarations?.some((declaration) =>
    annotationsOf(declaration).has('openapiContract'),
  );
  if (!marked) return undefined;
  const contract = arguments_?.[0];
  if (!contract)
    return fail(
      expression,
      'Annotated handlers require an explicit concrete contract type argument.',
    );
  return contract;
}

/** Extracts the same contract that gives the handler its framework-specific TypeScript types. */
export function handlerContract(
  statement: ts.VariableStatement,
  checker: ts.TypeChecker,
): { name: string; node: ts.TypeNode } {
  const declarations = statement.declarationList.declarations;
  const handler = declarations[0];
  if (declarations.length !== 1 || !handler || !ts.isIdentifier(handler.name))
    return fail(statement, 'Annotate one named handler per variable statement.');
  let contract: ts.TypeNode | undefined;
  const type = handler.type && unwrapType(handler.type);
  if (type && ts.isTypeReferenceNode(type)) {
    const target = aliasTarget(type, checker, (declaration) =>
      annotationsOf(declaration).has('openapiContract'),
    );
    if (target) contract = target.arguments[0];
    else contract = contractArgument(type.typeName, type.typeArguments, checker);
  }
  const initializer = handler.initializer && unwrapExpression(handler.initializer);
  if (!contract && initializer && ts.isCallExpression(initializer))
    contract = contractArgument(initializer, initializer.typeArguments, checker);
  if (!contract)
    return fail(
      statement,
      'Annotated handlers must use ExpressHandler<Contract> or webHandler<Contract>. Unrecognized generic types are not interpreted as contracts.',
    );
  return { name: handler.name.text, node: contract };
}
