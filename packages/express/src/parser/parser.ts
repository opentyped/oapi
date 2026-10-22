import { RegistrationTransform } from '~/parser/transform';
import ts from 'typescript';
import { sourceNodes } from '@opentyped/oapi-ast/nodes';
import { RouterMounts } from '~/parser/router';
import { mountedDeclarations } from '~/parser/declaration';
import type { Parser } from '@opentyped/oapi-compiler/parser/parser';
import type { Project } from '@opentyped/oapi-ast/project';
import type { ParserContext } from '@opentyped/oapi-compiler/parser/context';

export class ExpressParser implements Parser {
  readonly name = 'express/endpoints';
  readonly stage = 'discover';
  parse(context: ParserContext): void {
    const sources = endpointSources(context.project);
    context.transforms.push(new RegistrationTransform(context.project, sources));
    const routers = new RouterMounts(context.project);
    for (const source of sources) {
      if (
        source.isDeclarationFile ||
        context.project.program.isSourceFileFromExternalLibrary(source)
      )
        continue;
      let end = -1;
      for (const node of sourceNodes(source, [ts.SyntaxKind.CallExpression])) {
        if (node.pos < end || !ts.isCallExpression(node)) continue;
        const declarations = mountedDeclarations(
          node,
          context.project.checker,
          routers,
          context.options.openapi === '3.2.0',
        );
        if (!declarations.length) continue;
        context.declarations.push(...declarations);
        end = node.end;
      }
    }
  }
}

/** Only modules that can reach an annotated API need expensive call-type inspection. */
function endpointSources(project: Project): Set<ts.SourceFile> {
  const sources = project.program.getSourceFiles();
  const incoming = new Map<ts.SourceFile, Set<ts.SourceFile>>();
  const candidates = new Set<ts.SourceFile>();
  const globals = new Set<ts.SourceFile>();
  for (const source of sources) {
    if (/@openapi(?:Mount|Handler)\b/.test(source.text)) candidates.add(source);
    for (const node of sourceNodes(source, [
      ts.SyntaxKind.ImportDeclaration,
      ts.SyntaxKind.ExportDeclaration,
      ts.SyntaxKind.ExternalModuleReference,
      ts.SyntaxKind.ImportType,
      ts.SyntaxKind.CallExpression,
      ts.SyntaxKind.ModuleDeclaration,
    ])) {
      if (ts.isModuleDeclaration(node) && node.flags & ts.NodeFlags.GlobalAugmentation)
        globals.add(source);
      let specifier: ts.Node | undefined;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        specifier = node.moduleSpecifier;
      else if (ts.isExternalModuleReference(node)) specifier = node.expression;
      else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
        specifier = node.argument.literal;
      else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
      )
        specifier = node.arguments[0];
      if (specifier && ts.isStringLiteralLike(specifier)) {
        const declarations = project.checker.getSymbolAtLocation(specifier)?.declarations;
        for (const declaration of declarations ?? []) {
          const target = declaration.getSourceFile();
          const dependents = incoming.get(target) ?? new Set<ts.SourceFile>();
          dependents.add(source);
          incoming.set(target, dependents);
        }
      }
    }
  }
  for (const source of candidates) {
    // Script declarations and global augmentations can affect every application module.
    if (!ts.isExternalModule(source) || globals.has(source)) return new Set(sources);
    for (const dependent of incoming.get(source) ?? []) candidates.add(dependent);
  }
  // JavaScript can introduce type imports through JSDoc rather than module syntax.
  for (const source of sources)
    if (/\.[cm]?jsx?$/.test(source.fileName) && !source.isDeclarationFile) candidates.add(source);
  return candidates;
}
