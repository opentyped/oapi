import path from 'node:path';
import { Minimatch } from 'minimatch';
import ts from 'typescript';
import type { Project } from '@opentyped/oapi-ast/project';
import { GenerationError } from '@opentyped/oapi-openapi/diagnostic';
import { sourceNodes, sourcePath, nodeNames } from '@opentyped/oapi-ast/nodes';
import { tagsOf } from '@opentyped/oapi-ast/jsdoc';
import { sourceOf } from '@opentyped/oapi-ast/diagnostic';

const declarationLocations = new WeakMap<ts.Node, Map<string, string>>();

function declarationLocation(
  node: ts.Node,
  root: string,
  files: WeakMap<ts.SourceFile, string>,
): string {
  let locations = declarationLocations.get(node);
  const cached = locations?.get(root);
  if (cached !== undefined) return cached;
  const scopes: string[] = [];
  let current = node.parent;
  while (current && !ts.isSourceFile(current)) {
    const name = 'name' in current && current.name;
    if (name && typeof name === 'object' && 'kind' in name)
      scopes.unshift(`${current.kind}:${(name as ts.Node).getText()}`);
    else {
      const siblings: ts.Node[] = [];
      current.parent?.forEachChild((child) => {
        if (child.kind === current.kind) siblings.push(child);
      });
      scopes.unshift(`${current.kind}:${siblings.indexOf(current)}`);
    }
    current = current.parent;
  }
  const source = node.getSourceFile();
  let file = files.get(source);
  if (file === undefined) {
    file = path.relative(root, sourcePath(source)).split(path.sep).join('/');
    files.set(source, file);
  }
  const location = JSON.stringify([file, scopes]);
  if (!locations) declarationLocations.set(node, (locations = new Map()));
  locations.set(root, location);
  return location;
}

export interface NamespaceScope {
  root: string;
  namespaces: Readonly<Record<string, string>>;
}

/** Match physical declarations through configured source globs, including symlinked folders. */
class NamespaceRules {
  private readonly files = new WeakMap<ts.SourceFile, string | undefined>();
  private readonly rules: {
    matcher: Minimatch;
    prefix: string;
    base: string;
    namespace: string;
  }[] = [];

  constructor(scopes: readonly NamespaceScope[]) {
    for (const scope of scopes) {
      if (
        !scope.namespaces ||
        typeof scope.namespaces !== 'object' ||
        Array.isArray(scope.namespaces)
      )
        throw new GenerationError('namespaces must map source-file globs to namespace strings.');
      for (const [glob, namespace] of Object.entries(scope.namespaces)) {
        if (
          !glob.trim() ||
          path.isAbsolute(glob) ||
          /^[a-zA-Z]:/.test(glob) ||
          glob.includes('\\') ||
          glob.includes('\0') ||
          (glob.startsWith('!') && !glob.startsWith('!('))
        )
          throw new GenerationError(`Namespace glob must be a positive relative pattern: ${glob}.`);
        if (
          typeof namespace !== 'string' ||
          !/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/.test(namespace)
        )
          throw new GenerationError(`Invalid namespace prefix for ${glob}.`);
        const matcher = new Minimatch(glob.replace(/^(\.\/)+/, ''), {
          dot: true,
          nocomment: true,
          nonegate: true,
        });
        const prefixes = matcher.set.map((branch) => {
          const parts: string[] = [];
          for (const part of branch) {
            if (typeof part !== 'string') break;
            parts.push(part);
          }
          if (parts.length === branch.length) parts.pop();
          return parts;
        });
        const common: string[] = [];
        for (const part of prefixes[0] ?? []) {
          if (!prefixes.every((parts) => parts[common.length] === part)) break;
          common.push(part);
        }
        const prefix = common.join('/');
        const directory = path.resolve(scope.root, prefix);
        const base = ts.sys.realpath?.(directory) ?? directory;
        this.rules.push({ matcher, prefix, base, namespace });
      }
    }
  }

  name(node: ts.Node): string | undefined {
    const source = node.getSourceFile();
    if (this.files.has(source)) return this.files.get(source);
    const physical = sourcePath(source);
    let selected:
      { depth: number; name: string; folders: string[]; ambiguous: boolean } | undefined;
    for (const rule of this.rules) {
      const relative = path.relative(rule.base, physical);
      if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative))
        continue;
      const candidate = [rule.prefix, relative.split(path.sep).join('/')].filter(Boolean).join('/');
      if (!rule.matcher.match(candidate)) continue;
      const folders = path
        .dirname(relative)
        .split(path.sep)
        .filter((part) => part !== '.');
      const name = [rule.namespace, ...folders].join('.');
      if (!selected || rule.base.length > selected.depth)
        selected = { depth: rule.base.length, name, folders, ambiguous: false };
      else if (selected.depth === rule.base.length && selected.name !== name)
        selected.ambiguous = true;
    }
    if (selected?.ambiguous)
      return sourceOf(node).fail('Ambiguous namespace globs match this declaration.');
    if (selected?.folders.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part)))
      return sourceOf(node).fail(
        'Namespace subfolders require component-safe names; configure a more specific glob.',
      );
    this.files.set(source, selected?.name);
    return selected?.name;
  }
}

/** Declaration identity spans checked programs; repeated imports share their physical declaration. */
export class SchemaIdentity {
  private readonly locations = new WeakMap<ts.SourceFile, string>();
  private readonly declarations = new WeakMap<ts.Node, ts.Node>();
  private readonly names = new WeakMap<ts.Node, string>();
  private readonly anonymous = new Map<string, string>();
  private readonly ambiguous = new Set<string>();
  private readonly reserved = new Set<string>();
  private readonly generated = new Map<string, string>();
  private readonly root: string;
  private readonly namespaceRules: NamespaceRules;

  constructor(
    project: Project,
    projects: Iterable<Project> = [project],
    scopes: readonly NamespaceScope[] = [],
  ) {
    const namespaceRules = (this.namespaceRules = new NamespaceRules(scopes));
    const directory = path.dirname(project.configPath);
    const root = ts.sys.realpath?.(directory) ?? directory;
    this.root = root;
    const groups = new Map<string, Map<string, Set<ts.Node>>>();
    const requested = new Map<string, string>();
    const reserved = new Map<string, string>();
    const explicitNames = new Map<string, string>();
    for (const checked of projects) {
      const seen = new Set<ts.Symbol>();
      const physical = new Map<string, ts.Node>();
      const visit = (node: ts.Node): void => {
        if (
          ts.isInterfaceDeclaration(node) ||
          ts.isTypeAliasDeclaration(node) ||
          ts.isEnumDeclaration(node) ||
          ts.isEnumMember(node) ||
          ts.isClassDeclaration(node)
        ) {
          const symbol = node.name && checked.checker.getSymbolAtLocation(node.name);
          if (symbol && !seen.has(symbol)) {
            seen.add(symbol);
            const name = checked.checker.getFullyQualifiedName(symbol).replace(/^".*"\./, '');
            const declarations = symbol.declarations ?? [];
            const locations = declarations.map((declaration) =>
              declarationLocation(declaration, root, this.locations),
            );
            const identity = JSON.stringify([name, [...new Set(locations)].sort()]);
            const canonical = physical.get(identity) ?? node;
            physical.set(identity, canonical);
            for (const declaration of declarations) this.declarations.set(declaration, canonical);
            for (const declaration of declarations) {
              const annotations = tagsOf(declaration);
              const labels = annotations.filter((tag) => tag.name === 'schemaName');
              if (
                annotations.some((tag) => tag.name === 'namespace') &&
                !checked.program.isSourceFileFromExternalLibrary(declaration.getSourceFile())
              )
                sourceOf(declaration).fail(
                  '@namespace is unsupported; configure namespaces with source-file globs instead.',
                );
              if (labels.length > 1)
                sourceOf(declaration).fail('Duplicate @schemaName annotation.');
              const namespace = namespaceRules.name(declaration);
              const local = labels[0]?.value ?? name;
              const label = namespace === undefined ? labels[0]?.value : `${namespace}.${local}`;
              if (label === undefined) continue;
              if (labels.length && !/^[a-zA-Z0-9._-]+$/.test(label))
                sourceOf(declaration).fail(
                  '@schemaName requires a nonempty OpenAPI component name.',
                );
              if (requested.has(identity) && requested.get(identity) !== label)
                sourceOf(declaration).fail('Merged declarations must use the same @schemaName.');
              const explicit =
                labels.length > 0 || annotations.some((tag) => tag.name === 'schema');
              if (explicit && explicitNames.has(label) && explicitNames.get(label) !== identity)
                sourceOf(declaration).fail(`Duplicate explicit schema name ${label}.`);
              if (explicit) explicitNames.set(label, identity);
              requested.set(identity, label);
              reserved.set(label, identity);
            }
            const group = groups.get(name) ?? new Map<string, Set<ts.Node>>();
            const nodes = group.get(identity) ?? new Set<ts.Node>();
            for (const declaration of declarations) nodes.add(declaration);
            group.set(identity, nodes);
            groups.set(name, group);
          }
        }
      };
      for (const source of checked.program.getSourceFiles())
        if (!checked.program.isSourceFileDefaultLibrary(source))
          for (const node of sourceNodes(source, [
            ts.SyntaxKind.InterfaceDeclaration,
            ts.SyntaxKind.TypeAliasDeclaration,
            ts.SyntaxKind.EnumDeclaration,
            ts.SyntaxKind.EnumMember,
            ts.SyntaxKind.ClassDeclaration,
          ]))
            visit(node);
    }
    const assigned = new Set(reserved.keys());
    for (const [name, identities] of groups) {
      for (const [identity, nodes] of identities) {
        const explicit = requested.get(identity);
        if (explicit !== undefined) {
          for (const node of nodes) this.names.set(node, explicit);
          continue;
        }
        if (identities.size < 2 && !reserved.has(name)) {
          // Native names can differ across symlink aliases of the same declaration.
          for (const node of nodes) this.names.set(node, name);
          continue;
        }
        const first = nodes.values().next().value!;
        const candidate = [this.sourceScope(first), ...nodeNames(first)].join('.');
        if (groups.has(candidate) || reserved.has(candidate) || assigned.has(candidate))
          this.ambiguous.add(candidate);
        assigned.add(candidate);
        for (const node of nodes) this.names.set(node, candidate);
      }
    }
    for (const name of [...groups.keys(), ...assigned]) this.reserved.add(name);
  }

  private sourceScope(node: ts.Node): string {
    const namespace = this.namespaceRules.name(node);
    if (namespace !== undefined) return namespace;
    const parts = path
      .relative(this.root, sourcePath(node.getSourceFile()))
      .split(path.sep)
      .filter((part) => part !== '..' && part !== '.');
    const packages = parts.lastIndexOf('node_modules');
    const folders = packages >= 0 ? parts.slice(packages + 1) : parts;
    return folders
      .join('.')
      .replace(/(?:\.d)?\.[cm]?tsx?$/, '')
      .replace(/@/g, '');
  }

  namespace(node: ts.Node): string | undefined {
    return this.namespaceRules.name(node);
  }

  canonical(node: ts.Node): ts.Node {
    return this.declarations.get(node) ?? node;
  }

  generatedName(preferred: string): string {
    const existing = this.generated.get(preferred);
    if (existing !== undefined) return existing;
    const name = preferred;
    if (this.reserved.has(name))
      throw new GenerationError(
        `Cannot name generated schema '${name}': the name is already occupied. Configure namespaces or use @schemaName on the conflicting type.`,
      );
    this.reserved.add(name);
    this.generated.set(preferred, name);
    return name;
  }

  name(node: ts.Node): string | undefined {
    const existing = this.names.get(node);
    if (existing !== undefined && this.ambiguous.has(existing))
      return sourceOf(node).fail(
        `Cannot name schema '${existing}' unambiguously. Configure distinct source namespaces or use @schemaName.`,
      );
    if (existing !== undefined || (!ts.isTypeLiteralNode(node) && !ts.isMappedTypeNode(node)))
      return existing;
    const siblings: ts.Node[] = [];
    node.parent?.forEachChild((child) => {
      if (child.kind === node.kind) siblings.push(child);
    });
    const identity = JSON.stringify([
      declarationLocation(node, this.root, this.locations),
      siblings.indexOf(node),
      ...(ts.isMappedTypeNode(node) ? ['mapped'] : []),
    ]);
    let name = this.anonymous.get(identity);
    if (name === undefined) {
      const path = nodeNames(node);
      if (!path.length)
        return sourceOf(node).fail('Cannot name anonymous schema. Introduce a named type alias.');
      name = [this.sourceScope(node), ...path].join('.');
      if (this.reserved.has(name))
        return sourceOf(node).fail(
          `Cannot name anonymous schema '${name}' unambiguously. Introduce a named type alias.`,
        );
      this.reserved.add(name);
      this.anonymous.set(identity, name);
    }
    this.names.set(node, name);
    return name;
  }
}
