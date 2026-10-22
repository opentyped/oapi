import ts from 'typescript';
import { DocumentReferences } from '@opentyped/oapi-openapi/document/reference';
import { formatPointer } from '@opentyped/oapi-openapi/pointer';
import { STRING, NEVER, TypeDeclarations, propertyText, unionType } from '~/ast';

const parameterNames: Record<string, string> = {
  path: 'params',
  query: 'query',
  header: 'headers',
  cookie: 'cookies',
};

/** Extracts endpoint wire types from the already generated operation declarations. */
class EndpointTypes {
  constructor(private readonly declarations: TypeDeclarations) {}

  private content(node: ts.Node | undefined): ts.PropertySignature[] {
    return this.declarations.members(this.declarations.property(node, 'content')?.type);
  }

  private payload(operation: ts.TypeNode | undefined): ts.PropertySignature | undefined {
    const request = this.declarations.property(operation, 'requestBody');
    const types = this.content(request?.type).flatMap((media) => (media.type ? [media.type] : []));
    if (!types.length) return;
    return ts.factory.createPropertySignature(
      undefined,
      'body',
      request?.questionToken,
      unionType(types),
    );
  }

  input(operation: ts.TypeNode | undefined): ts.TypeNode {
    const input: ts.PropertySignature[] = [];
    const parameters = this.declarations.property(operation, 'parameters');
    for (const field of this.declarations.members(parameters?.type)) {
      if (!field.type || field.type.kind === ts.SyntaxKind.NeverKeyword) continue;
      const name = parameterNames[propertyText(field.name)];
      if (name)
        input.push(
          ts.factory.createPropertySignature(undefined, name, field.questionToken, field.type),
        );
    }
    const payload = this.payload(operation);
    if (payload) input.push(payload);
    if (!input.length) return ts.factory.createTypeReferenceNode('Record', [STRING, NEVER]);
    return ts.factory.createTypeLiteralNode(input);
  }

  response(operation: ts.TypeNode | undefined, success: boolean): ts.TypeNode {
    const responses = this.declarations.property(operation, 'responses');
    const fields = this.declarations.members(responses?.type);
    const coversSuccess = fields.some((field) => propertyText(field.name) === '2XX');
    const bodies: ts.TypeNode[] = [];
    for (const field of fields) {
      const status = propertyText(field.name);
      if (status === 'default') {
        if (success && coversSuccess) continue;
      } else if (status.startsWith('2') !== success) continue;
      for (const media of this.content(field.type)) {
        if (media.type) bodies.push(media.type);
      }
    }
    return unionType(bodies);
  }
}

export function endpointDeclarations(
  nodes: readonly ts.Node[],
  namespaces: ReadonlyMap<string, string>,
  emit: (module: string, name: string, body: ts.TypeNode) => void,
): void {
  const declarations = new TypeDeclarations(nodes);
  const types = new EndpointTypes(declarations);
  for (const operation of declarations.members('operations')) {
    const id = propertyText(operation.name);
    const module = namespaces.get(id) ?? 'api';
    const name = id.replace(
      /(^|[^\p{ID_Continue}$]+)([\p{ID_Start}$])/gu,
      (_match, _separator: string, letter: string) => letter.toUpperCase(),
    );
    emit(module, name + 'Input', types.input(operation.type));
    emit(module, name + 'Response', types.response(operation.type, true));
    emit(module, name + 'Error', types.response(operation.type, false));
  }
}

/** Keep only a namespace's methods, including when namespaces share the same URL. */
export function namespacePaths(
  nodes: readonly ts.Node[],
  document: object,
  namespace: string,
): ts.TypeNode {
  const declarations = new TypeDeclarations(nodes);
  const references = new DocumentReferences(document);
  const paths: ts.PropertySignature[] = [];
  for (const path of declarations.members('paths')) {
    const item = references.resolve(formatPointer(['paths', propertyText(path.name)], true));
    if (!item || typeof item !== 'object' || Array.isArray(item))
      throw new Error(`Cannot resolve path ${propertyText(path.name)}.`);
    let included = false;
    const methods = (
      fields: ts.PropertySignature[],
      owner: Record<string, unknown>,
    ): ts.PropertySignature[] =>
      fields.map((field) => {
        const name = propertyText(field.name);
        if (name === 'parameters' || field.type?.kind === ts.SyntaxKind.NeverKeyword) return field;
        if (name === 'additionalOperations')
          return ts.factory.updatePropertySignature(
            field,
            field.modifiers,
            field.name,
            field.questionToken,
            ts.factory.createTypeLiteralNode(
              methods(declarations.members(field.type), owner[name] as Record<string, unknown>),
            ),
          );
        let operation = owner[name] as Record<string, unknown>;
        if (typeof operation?.$ref === 'string')
          operation = references.resolve(operation.$ref) as Record<string, unknown>;
        if ((operation?.['x-opentyped-namespace'] ?? 'api') === namespace) {
          included = true;
          return field;
        }
        return ts.factory.updatePropertySignature(
          field,
          field.modifiers,
          field.name,
          ts.factory.createToken(ts.SyntaxKind.QuestionToken),
          NEVER,
        );
      });
    const fields = methods(declarations.members(path.type), item as Record<string, unknown>);
    if (included)
      paths.push(
        ts.factory.updatePropertySignature(
          path,
          path.modifiers,
          path.name,
          path.questionToken,
          ts.factory.createTypeLiteralNode(fields),
        ),
      );
  }
  return paths.length
    ? ts.factory.createTypeLiteralNode(paths)
    : ts.factory.createTypeReferenceNode('Record', [STRING, NEVER]);
}
