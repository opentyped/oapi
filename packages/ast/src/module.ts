import path from 'node:path';
import ts from 'typescript';

/** Module identities from checked imports and root-relative resolution; never load runtime code. */
export function moduleSymbols(program: ts.Program, name: string, root: string): ts.Symbol[] {
  const checker = program.getTypeChecker();
  const modules = new Set<ts.Symbol>();
  const add = (node: ts.Node): void => {
    const symbol = checker.getSymbolAtLocation(node);
    if (symbol) modules.add(symbol);
  };
  for (const source of program.getSourceFiles()) {
    const visit = (node: ts.Node): void => {
      if (
        ts.isStringLiteralLike(node) &&
        node.text === name &&
        (ts.isImportDeclaration(node.parent) ||
          ts.isExportDeclaration(node.parent) ||
          ts.isExternalModuleReference(node.parent) ||
          ts.isLiteralTypeNode(node.parent) ||
          ts.isModuleDeclaration(node.parent))
      )
        add(node);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  for (const mode of [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS] as const) {
    const resolved = ts.resolveModuleName(
      name,
      path.join(root, '__oapi__.ts'),
      program.getCompilerOptions(),
      ts.sys,
      undefined,
      undefined,
      mode,
    ).resolvedModule;
    if (!resolved) continue;
    const source =
      program.getSourceFile(resolved.resolvedFileName) ??
      program.getSourceFile(
        ts.sys.realpath?.(resolved.resolvedFileName) ?? resolved.resolvedFileName,
      );
    if (source) add(source);
  }
  return [...modules];
}
