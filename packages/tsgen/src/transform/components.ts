import ts from 'typescript';
import { createRef } from '~/pointer';
import { jsdocComment, modifiers, NEVER, propertyIndex } from '~/ast';
import { getEntries } from '~/resolve';
import { headerType, mediaTypeType, requestBodyType, responseType } from '~/transform/content';
import { parameterType } from '~/transform/operations';
import { pathItemType } from '~/transform/paths';
import { schemaType } from '~/transform/schema';
import type { Context } from '~/context';
import type {
  ComponentsObject,
  HeaderObject,
  ParameterObject,
  PathItemObject,
  RequestBodyObject,
  ResponseObject,
} from '~/types';

/**
 * Components Object: one section per component kind, in fixed order, each
 * `never` when the document declares no components of that kind.
 */
export function componentsNodes(components: ComponentsObject, ctx: Context): ts.Node[] {
  const sections: ts.TypeElement[] = [];
  componentSection(sections, 'schemas', components.schemas, ctx, (schema, path) =>
    schemaType(schema, ctx, path),
  );
  componentSection(sections, 'mediaTypes', components.mediaTypes, ctx, (media, path) =>
    mediaTypeType(media, ctx, path),
  );
  // Reference-valued components pass through their transformer as-is; the
  // transformers read schema/content fields and degrade gracefully.
  componentSection(sections, 'responses', components.responses, ctx, (response, path) =>
    responseType(response as ResponseObject, ctx, path),
  );
  componentSection(sections, 'parameters', components.parameters, ctx, (parameter, path) =>
    parameterType(parameter as ParameterObject, ctx, path),
  );
  componentSection(sections, 'requestBodies', components.requestBodies, ctx, (body, path) =>
    requestBodyType(body as RequestBodyObject, ctx, path),
  );
  componentSection(sections, 'headers', components.headers, ctx, (header, path) =>
    headerType(header as HeaderObject, ctx, path),
  );
  componentSection(sections, 'pathItems', components.pathItems, ctx, (item, path) =>
    pathItemType(item as PathItemObject, ctx, path),
  );
  return [ts.factory.createTypeLiteralNode(sections)];
}

function componentSection<T>(
  sections: ts.TypeElement[],
  key: string,
  record: Record<string, T> | undefined,
  ctx: Context,
  transform: (value: T, path: string) => ts.TypeNode,
): void {
  const items: ts.TypeElement[] = [];
  for (const [name, value] of getEntries(record, ctx)) {
    const path = createRef(['components', key, name]);
    let type = transform(value, path);
    if (key === 'schemas') {
      const alias = ctx.schemaAliases.get(path);
      if (alias) {
        ctx.injectFooter.push(
          ts.factory.createTypeAliasDeclaration(
            /* modifiers */ undefined,
            alias,
            /* typeParameters */ undefined,
            type,
          ),
        );
        type = ts.factory.createTypeReferenceNode(alias);
      }
    }
    const property = ts.factory.createPropertySignature(
      modifiers({ readonly: ctx.immutable }),
      propertyIndex(name),
      /* questionToken */ undefined,
      type,
    );
    jsdocComment(value, property);
    items.push(property);
  }
  sections.push(
    ts.factory.createPropertySignature(
      /* modifiers */ undefined,
      propertyIndex(key),
      /* questionToken */ undefined,
      items.length ? ts.factory.createTypeLiteralNode(items) : NEVER,
    ),
  );
}
