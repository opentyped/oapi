import { visitDocument } from '@typedapi/openapi/document/visitor';
import ts from 'typescript';
import { printAst, recordType, STRING, NEVER } from '~/ast';
import { endpointDeclarations, namespacePaths } from '~/endpoint';
import { definitionNodes } from '~/generator';
import type { DefinitionOptions } from '~/generator';
import type { SchemaExport } from '@typedapi/openapi/schema/definition';

export interface DeclarationOptions extends DefinitionOptions {
  /** Prefix of ambient module names; defaults to openapi. */
  prefix?: string;
  /** Compiler-provided source names; every document schema is exported. */
  models?: readonly SchemaExport[];
}

type Export = SchemaExport & { moduleName: string };

/** One ambient declaration file, with real named model types and a typed route schema. */
export function generateDeclarations(document: object, options: DeclarationOptions = {}): string {
  const configured = options.prefix ?? 'openapi';
  if (typeof configured !== 'string') throw new Error('Declaration prefix must be a string.');
  const prefix = configured.replace(/\/$/, '');
  if (
    !prefix ||
    /\s|[\\#?]/.test(prefix) ||
    prefix.split('/').some((part) => !part || part === '.' || part === '..')
  )
    throw new Error('Declaration prefix must be a non-relative module prefix.');
  const nodes = definitionNodes(document, options);
  const components = nodes.find(
    (node): node is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(node) && node.name.text === 'components',
  );
  // Factory nodes have no source text; read their property names directly.
  const schemas = components?.members.find(
    (member): member is ts.PropertySignature =>
      ts.isPropertySignature(member) &&
      ts.isIdentifier(member.name) &&
      member.name.text === 'schemas',
  );
  const entries = new Map<string, ts.PropertySignature>();
  if (schemas?.type && ts.isTypeLiteralNode(schemas.type))
    for (const property of schemas.type.members)
      if (
        ts.isPropertySignature(property) &&
        (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
      )
        entries.set(property.name.text, property);
  const namespaces = new Map<string, string>();
  const routeNamespaces = new Set<string>();
  visitDocument(document, {
    object(operation, role): void {
      if (role !== 'operationObject') return;
      const namespace = operation['x-typedapi-namespace'] ?? 'api';
      if (typeof namespace !== 'string')
        throw new Error('x-typedapi-namespace must be a module path string.');
      routeNamespaces.add(namespace);
      if (typeof operation.operationId === 'string')
        namespaces.set(operation.operationId, namespace);
    },
  });
  const provided = new Map(options.models?.map((model) => [model.component, model]));
  if (options.models && provided.size !== options.models.length)
    throw new Error('Duplicate source model component.');
  const modules = [
    ...new Set([...[...provided.values()].map((model) => model.module), ...routeNamespaces]),
  ].sort((left, right) => right.length - left.length);
  const models = [...entries.keys()].map((component) => {
    const explicit = provided.get(component);
    if (explicit) return explicit;
    const module = modules.find((name) => component.startsWith(name.replaceAll('/', '.') + '.'));
    if (module) {
      const parts = component.slice(module.length + 1).split('.');
      const name = parts
        .map((part, index) => (index ? part.charAt(0).toUpperCase() + part.slice(1) : part))
        .join('');
      return { component, module, name };
    }
    const parts = component.split('.');
    return { component, name: parts.pop()!, module: parts.length ? parts.join('/') : 'models' };
  });
  for (const model of provided.values())
    if (!entries.has(model.component))
      throw new Error(`Missing model component ${model.component}.`);
  const exports = new Map<string, Export>();
  const occupied = new Set<string>();
  for (const model of models) {
    if (model.name === 'schema')
      throw new Error(
        `Reserved export name schema in ${model.module}. Rename the source type or document component.`,
      );
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false);
    scanner.setText(model.name);
    if (
      scanner.scan() !== ts.SyntaxKind.Identifier ||
      scanner.scan() !== ts.SyntaxKind.EndOfFileToken
    )
      throw new Error(`Invalid model export name ${model.name}.`);
    if (
      !model.module ||
      /\s|[\\#?]/.test(model.module) ||
      model.module.split('/').some((part) => !part || part === '.' || part === '..')
    )
      throw new Error(`Invalid or reserved model module ${model.module}.`);
    const moduleName = prefix + '/' + model.module;
    const key = moduleName + ':' + model.name;
    if (occupied.has(key) || exports.has(model.component))
      throw new Error(`Duplicate model export ${key}. Configure distinct source namespaces.`);
    occupied.add(key);
    exports.set(model.component, { ...model, moduleName });
  }
  const declarations = new Map<string, ts.TypeAliasDeclaration>();
  for (const node of nodes)
    if (ts.isTypeAliasDeclaration(node)) declarations.set(node.name.text, node);
  const aliases = new Map<string, Export>();
  const bodies = new Map<string, ts.TypeNode>();
  for (const model of exports.values()) {
    let body = entries.get(model.component)!.type!;
    if (ts.isTypeReferenceNode(body) && ts.isIdentifier(body.typeName)) {
      const alias = declarations.get(body.typeName.text);
      if (alias) {
        aliases.set(body.typeName.text, model);
        body = alias.type;
      }
    }
    bodies.set(model.component, body);
  }
  const declared = new Set(
    nodes.flatMap((node) =>
      ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node) ? [node.name.text] : [],
    ),
  );
  const importType = (module: string, name: string): ts.ImportTypeNode =>
    ts.factory.createImportTypeNode(
      ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(module)),
      undefined,
      ts.factory.createIdentifier(name),
      undefined,
    );
  const rewrite = <T extends ts.Node>(node: T, modelModule: boolean, currentModule?: string): T => {
    const reference = (model: Export): ts.TypeNode =>
      model.moduleName === currentModule
        ? ts.factory.createTypeReferenceNode(model.name, undefined)
        : importType(model.moduleName, model.name);
    const result = ts.transform(node, [
      (context) => {
        const visit: ts.Visitor = (node) => {
          if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
            const model = aliases.get(node.typeName.text);
            if (model) return reference(model);
            if (modelModule && declared.has(node.typeName.text)) {
              return ts.factory.createImportTypeNode(
                ts.factory.createLiteralTypeNode(
                  ts.factory.createStringLiteral(prefix + '/routes'),
                ),
                undefined,
                node.typeName,
                node.typeArguments,
              );
            }
          }
          if (
            ts.isIndexedAccessTypeNode(node) &&
            ts.isLiteralTypeNode(node.indexType) &&
            ts.isStringLiteral(node.indexType.literal) &&
            ts.isIndexedAccessTypeNode(node.objectType) &&
            ts.isTypeReferenceNode(node.objectType.objectType) &&
            ts.isIdentifier(node.objectType.objectType.typeName) &&
            node.objectType.objectType.typeName.text === 'components' &&
            ts.isLiteralTypeNode(node.objectType.indexType) &&
            ts.isStringLiteral(node.objectType.indexType.literal) &&
            node.objectType.indexType.literal.text === 'schemas'
          ) {
            const model = exports.get(node.indexType.literal.text);
            if (model) return reference(model);
          }
          return ts.visitEachChild(node, visit, context);
        };
        return (root): T => ts.visitNode(root, visit) as T;
      },
    ]);
    const value = result.transformed[0] as T;
    result.dispose();
    return value;
  };
  const groups = new Map<string, ts.Statement[]>(modules.map((name) => [prefix + '/' + name, []]));
  for (const model of exports.values()) {
    const body = rewrite(bodies.get(model.component)!, true, model.moduleName);
    const declaration = ts.factory.createTypeAliasDeclaration(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      model.name,
      undefined,
      body,
    );
    const comments = ts.getSyntheticLeadingComments(entries.get(model.component)!);
    if (comments)
      ts.setSyntheticLeadingComments(
        declaration,
        comments.map((comment) => ({ ...comment })),
      );
    const group = groups.get(model.moduleName) ?? [];
    group.push(declaration);
    groups.set(model.moduleName, group);
  }
  endpointDeclarations(nodes, namespaces, (module, name, body) => {
    const moduleName = prefix + '/' + module;
    if (
      !module ||
      /\s|[\\#?]/.test(module) ||
      module.split('/').some((part) => !part || part === '.' || part === '..')
    )
      throw new Error(`Invalid or reserved endpoint module ${module}.`);
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false);
    scanner.setText(name);
    if (
      scanner.scan() !== ts.SyntaxKind.Identifier ||
      scanner.scan() !== ts.SyntaxKind.EndOfFileToken
    )
      throw new Error(
        `Operation ID cannot form a named endpoint type: ${name}. Use an identifier-like operationId.`,
      );
    const key = moduleName + ':' + name;
    if (name === 'schema' || occupied.has(key))
      throw new Error(
        `Duplicate endpoint export ${key}. Configure distinct source namespaces or operation IDs.`,
      );
    occupied.add(key);
    const group = groups.get(moduleName) ?? [];
    group.push(
      ts.factory.createTypeAliasDeclaration(
        [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        name,
        undefined,
        rewrite(body, true),
      ),
    );
    groups.set(moduleName, group);
  });
  const routeNodes = nodes
    .filter((node) => !ts.isTypeAliasDeclaration(node) || !aliases.has(node.name.text))
    .map((node) => rewrite(node, false)) as ts.Statement[];
  // Component entries point at the public model bodies rather than retaining duplicate definitions.
  const routeComponents = routeNodes.find(
    (node): node is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(node) && node.name.text === 'components',
  );
  const routeSchemas = routeComponents?.members.find(
    (member): member is ts.PropertySignature =>
      ts.isPropertySignature(member) &&
      ts.isIdentifier(member.name) &&
      member.name.text === 'schemas',
  );
  if (routeSchemas?.type && ts.isTypeLiteralNode(routeSchemas.type)) {
    const fields = routeSchemas.type.members.map((property) => {
      if (
        !ts.isPropertySignature(property) ||
        !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
      )
        return property;
      const model = exports.get(property.name.text);
      return model
        ? ts.factory.updatePropertySignature(
            property,
            property.modifiers,
            property.name,
            property.questionToken,
            importType(model.moduleName, model.name),
          )
        : property;
    });
    const replacement = ts.factory.updatePropertySignature(
      routeSchemas,
      routeSchemas.modifiers,
      routeSchemas.name,
      routeSchemas.questionToken,
      ts.factory.createTypeLiteralNode(fields),
    );
    const index = routeNodes.indexOf(routeComponents!);
    routeNodes[index] = ts.factory.updateInterfaceDeclaration(
      routeComponents!,
      routeComponents!.modifiers,
      routeComponents!.name,
      routeComponents!.typeParameters,
      routeComponents!.heritageClauses,
      routeComponents!.members.map((member) => (member === routeSchemas ? replacement : member)),
    );
  }
  for (const [moduleName, statements] of groups) {
    const namespace = moduleName.slice(prefix.length + 1);
    if (
      !namespace ||
      /\s|[\\#?]/.test(namespace) ||
      namespace.split('/').some((part) => !part || part === '.' || part === '..')
    )
      throw new Error(`Invalid namespace module ${namespace}.`);
    if (namespace === 'routes') continue;
    statements.push(
      ts.factory.createTypeAliasDeclaration(
        [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        'schema',
        undefined,
        routeNamespaces.has(namespace)
          ? rewrite(namespacePaths(nodes, document, namespace), true, moduleName)
          : recordType(STRING, NEVER),
      ),
    );
  }
  const routeExports = groups.get(prefix + '/routes') ?? [];
  for (const statement of routeExports) {
    if (ts.isTypeAliasDeclaration(statement) && declared.has(statement.name.text))
      throw new Error(`Reserved infrastructure export ${statement.name.text} in ${prefix}/routes.`);
  }
  routeNodes.push(
    ts.factory.createTypeAliasDeclaration(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      'schema',
      undefined,
      groups.has(prefix + '/routes')
        ? rewrite(namespacePaths(nodes, document, 'routes'), false)
        : ts.factory.createTypeReferenceNode('paths'),
    ),
  );
  groups.set(prefix + '/routes', [...routeExports, ...routeNodes]);
  const ambientModules = [...groups]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, statements]) =>
      ts.factory.createModuleDeclaration(
        [ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword)],
        ts.factory.createStringLiteral(name),
        ts.factory.createModuleBlock(statements),
      ),
    );
  return '/** Generated by TypedAPI. Do not edit. */\n' + printAst(ambientModules);
}
