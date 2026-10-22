import ts from 'typescript';
import path from 'node:path';
import { sourceOf } from '@opentyped/oapi-ast/diagnostic';
import type { Project } from '@opentyped/oapi-ast/project';

/** Generated declarations are consumers of source contracts, never generation inputs. */
export function assertSourceContracts(
  project: Project,
  roots: readonly ts.Node[],
  declarations: ReadonlyMap<string, string>,
): void {
  if (!declarations.size) return;
  const files = new Set([...declarations.keys()].map((file) => path.resolve(file)));
  const seen = new Set<ts.Node>();
  const visit = (node: ts.Node): void => {
    if (seen.has(node)) return;
    seen.add(node);
    if (files.has(path.resolve(node.getSourceFile().fileName)))
      sourceOf(node).fail(
        'Generation inputs cannot depend on generated declarations. Import the source contract instead.',
      );
    if (project.program.isSourceFileDefaultLibrary(node.getSourceFile())) return;
    if (ts.isIdentifier(node)) {
      let symbol = project.checker.getSymbolAtLocation(node);
      if (symbol && symbol.flags & ts.SymbolFlags.Alias)
        symbol = project.checker.getAliasedSymbol(symbol);
      for (const declaration of symbol?.declarations ?? []) {
        if (files.has(path.resolve(declaration.getSourceFile().fileName))) visit(declaration);
        else if (!ts.isSourceFile(declaration) && !ts.isModuleDeclaration(declaration))
          visit(declaration);
      }
    }
    ts.forEachChild(node, visit);
  };
  for (const root of roots) visit(root);
}
