import path from 'node:path';
import { SchemaGenerator } from '@typedapi/schema';
import { formatPointer } from '@typedapi/openapi/pointer';
import type { TypeMapping, SchemaRoot } from '@typedapi/schema';
import type { Project } from '@typedapi/ast/project';
import { objectSchema } from '@typedapi/openapi/schema/shape';
import { componentName } from '@typedapi/openapi/schema/reference';
import { absoluteSchema } from '@typedapi/openapi/schema/resource';
import { mapSchema } from '@typedapi/openapi/schema/visitor';
import type { Compilation } from '@typedapi/openapi/schema/compilation';
import type { Components, Schema } from '@typedapi/openapi/schema/definition';
import type { ModelDeclaration, ModelIdentity } from '~/parser/declaration';
import type { TypePolicy } from '~/parser/schema/safety';

/** Adapt TypeChecker schemas to the document pipeline without executing application source. */
export function compileSchemas(
  project: Project,
  declarations: ModelDeclaration[],
  identities: ModelIdentity,
  documentUri?: string,
  types?: TypePolicy,
  typeMappings?: readonly TypeMapping[],
): Compilation {
  const generatedName = (preferred: string): string =>
    identities.generatedName?.(componentName(preferred)) ?? componentName(preferred);
  const roots: SchemaRoot[] = [];
  const inputs = new Map<ModelDeclaration, SchemaRoot>();
  const outputs = new Map<ModelDeclaration, SchemaRoot>();
  const rootFor = (node: ModelDeclaration['node'], name: string, alias: boolean): SchemaRoot => {
    const root: SchemaRoot = {
      node,
      type: project.checker.getTypeAtLocation(node),
      name: componentName(name),
      alias,
    };
    roots.push(root);
    return root;
  };
  for (const declaration of declarations) {
    // Operation IDs may contain Unicode; private schema roots use the contract's name instead.
    const type = project.checker.getTypeAtLocation(declaration.node);
    const owner = (type.aliasSymbol ?? type.getSymbol())?.declarations?.[0];
    const contractName = /^[a-zA-Z0-9._-]+$/.test(declaration.name)
      ? declaration.name
      : ((owner && identities.name(owner)) ?? declaration.name);
    inputs.set(
      declaration,
      rootFor(
        declaration.node,
        declaration.emitSchema || declaration.emitResponse
          ? (identities.name(declaration.node) ?? declaration.name)
          : generatedName(`Contract.${contractName}`),
        !declaration.emitSchema && !declaration.emitResponse,
      ),
    );
    if (declaration.output)
      outputs.set(
        declaration,
        rootFor(declaration.output, generatedName(`Contract.${contractName}.Output`), true),
      );
  }
  const generator = new SchemaGenerator(project.program, {
    root: path.dirname(project.configPath),
    name: (node): string | undefined => {
      const name = identities.name(node);
      return name === undefined ? undefined : componentName(name);
    },
    generatedName,
    namespace: (node): string | undefined => identities.namespace?.(node),
    ...(types ? { types } : {}),
    ...(typeMappings ? { typeMappings } : {}),
  });
  let result: ReturnType<SchemaGenerator['compile']>;
  try {
    result = generator.compile(roots, {
      path: ['components', 'schemas'],
      pending: [
        ['paths'],
        ['webhooks'],
        ...[
          'parameters',
          'headers',
          'requestBodies',
          'responses',
          'callbacks',
          'pathItems',
          'mediaTypes',
        ].map((section) => ['components', section]),
      ],
      ...(documentUri === undefined ? {} : { baseUri: documentUri }),
    });
  } catch (error) {
    const message = `Schema generation failed: ${error instanceof Error ? error.message : String(error)}`;
    if (declarations[0]) return declarations[0].source.fail(message);
    throw error;
  }
  const normalize = (schema: unknown): Schema => mapSchema(schema as Schema, (item) => item);
  const privateRoots = new Set(roots.filter((root) => root.alias).map((root) => root.name));
  const components: Components = Object.create(null) as Components;
  for (const [name, schema] of Object.entries(result.definitions))
    if (!privateRoots.has(name)) components[name] = normalize(schema);
  const responses: Compilation['responses'] = Object.create(null) as Compilation['responses'];
  const compiled = declarations.map((declaration) => {
    let schema = normalize(result.roots.get(inputs.get(declaration)!));
    const output = outputs.get(declaration);
    if (output) {
      const payload = normalize(result.roots.get(output));
      const input = objectSchema(schema, components, declaration.source, 'Endpoint Input');
      if (Object.hasOwn(input.properties ?? {}, 'responses'))
        declaration.source.fail(
          'Input/Output shorthand Input must not contain responses; use the single-contract form.',
        );
      schema = {
        ...input,
        properties: {
          ...input.properties,
          responses: {
            type: 'object',
            additionalProperties: false,
            properties: {
              '200': {
                type: 'object',
                additionalProperties: false,
                properties: { body: payload },
                required: ['body'],
              },
            },
            required: ['200'],
          },
        },
        required: [...(input.required ?? []), 'responses'],
      };
    }
    if (declaration.emitSchema)
      schema = {
        $ref: formatPointer(['components', 'schemas', inputs.get(declaration)!.name], true),
      };
    if (declaration.emitResponse)
      responses[componentName(identities.name(declaration.node) ?? declaration.name)] = {
        schema,
        source: declaration.source,
      };
    return {
      source: declaration.source,
      annotations: declaration.annotations,
      emitSchema: declaration.emitSchema,
      emitOperation: declaration.emitOperation,
      emitResponse: declaration.emitResponse,
      ...(declaration.additionalTags === undefined
        ? {}
        : { additionalTags: declaration.additionalTags }),
      name: declaration.emitSchema
        ? componentName(identities.name(declaration.node) ?? declaration.name)
        : declaration.name,
      schema,
    };
  });
  if (documentUri !== undefined) {
    for (const [name, schema] of Object.entries(components))
      components[name] = absoluteSchema(schema, documentUri, components);
    for (const declaration of compiled)
      declaration.schema = absoluteSchema(declaration.schema, documentUri, components);
    for (const response of Object.values(responses))
      response.schema = absoluteSchema(response.schema, documentUri, components);
  }
  return { declarations: compiled, components, responses };
}
