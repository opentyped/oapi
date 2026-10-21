import ts from 'typescript';
import { createRef, escapePointer } from '~/pointer';
import {
  jsdocComment,
  modifiers,
  NEVER,
  propertyIndex,
  QUESTION_TOKEN,
  refType,
  STRING,
  UNKNOWN,
} from '~/ast';
import { getEntries } from '~/resolve';
import { schemaType } from '~/transform/schema';
import type { Context } from '~/context';
import type {
  HeaderObject,
  MediaTypeObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  ResponsesObject,
} from '~/types';

/** Payload type of a media type; absent schemas widen to `unknown`. */
export function mediaTypeType(
  input: MediaTypeObject | ReferenceObject,
  ctx: Context,
  path: string,
): ts.TypeNode {
  const media = '$ref' in input ? ctx.resolve<MediaTypeObject>(input.$ref) : input;
  if (!media) throw new Error(`Cannot resolve media type at ${path}`);
  if (media.schema === undefined) return UNKNOWN;
  return schemaType(media.schema, ctx, path);
}

/** OpenAPI 3.2 `itemSchema` describes each framed item, not the aggregate payload. */
export function itemContent(
  content: Record<string, MediaTypeObject | ReferenceObject> | undefined,
  ctx: Context,
  path: string,
): ts.PropertySignature[] {
  const items: ts.TypeElement[] = [];
  for (const [name, input] of Object.entries(content ?? {})) {
    const media = '$ref' in input ? ctx.resolve<MediaTypeObject>(input.$ref) : input;
    if (!media) throw new Error(`Cannot resolve media type at ${path}`);
    if (media.itemSchema === undefined) continue;
    items.push(
      ts.factory.createPropertySignature(
        modifiers({ readonly: ctx.immutable }),
        propertyIndex(name),
        /* questionToken */ undefined,
        schemaType(media.itemSchema, ctx, createRef([path, 'content', name, 'itemSchema'])),
      ),
    );
  }
  return items.length
    ? [
        ts.factory.createPropertySignature(
          modifiers({ readonly: ctx.immutable }),
          'itemContent',
          /* questionToken */ undefined,
          ts.factory.createTypeLiteralNode(items),
        ),
      ]
    : [];
}

/** Request Body Object: one property per content type, plus any item content. */
export function requestBodyType(
  requestBody: RequestBodyObject,
  ctx: Context,
  path: string,
): ts.TypeNode {
  const content: ts.TypeElement[] = [];
  for (const [contentType, media] of getEntries(requestBody.content, ctx)) {
    const property = ts.factory.createPropertySignature(
      modifiers({ readonly: ctx.immutable }),
      propertyIndex(contentType),
      /* questionToken */ undefined,
      mediaTypeType(media, ctx, createRef([path, 'content', contentType])),
    );
    jsdocComment(media, property);
    content.push(property);
  }
  return ts.factory.createTypeLiteralNode([
    ...itemContent(requestBody.content, ctx, path),
    ts.factory.createPropertySignature(
      modifiers({ readonly: ctx.immutable }),
      'content',
      /* questionToken */ undefined,
      ts.factory.createTypeLiteralNode(
        content.length
          ? content
          : // add `"*/*": never` if no media types are defined
            [
              ts.factory.createPropertySignature(
                /* modifiers */ undefined,
                propertyIndex('*/*'),
                QUESTION_TOKEN,
                NEVER,
              ),
            ],
      ),
    ),
  ]);
}

/** Responses Object: one property per response code. */
export function responsesType(responses: ResponsesObject, ctx: Context, path: string): ts.TypeNode {
  const members: ts.TypeElement[] = [];
  for (const [code, response] of getEntries(responses, ctx)) {
    const type =
      '$ref' in response
        ? refType(response.$ref)
        : responseType(response, ctx, createRef([path, 'responses', code]));
    const property = ts.factory.createPropertySignature(
      modifiers({ readonly: ctx.immutable }),
      propertyIndex(code),
      /* questionToken */ undefined,
      type,
    );
    jsdocComment(response, property);
    members.push(property);
  }
  return members.length ? ts.factory.createTypeLiteralNode(members) : NEVER;
}

/** Response Object: headers (with an unknown-header fallback), content, items. */
export function responseType(response: ResponseObject, ctx: Context, path: string): ts.TypeNode {
  const members: ts.TypeElement[] = [];

  const headers: ts.TypeElement[] = [];
  for (const [name, header] of getEntries(response.headers, ctx)) {
    const optional = '$ref' in header || header.required ? undefined : QUESTION_TOKEN;
    const type =
      '$ref' in header
        ? refType(header.$ref)
        : headerType(header, ctx, createRef([path, 'headers', name]));
    const property = ts.factory.createPropertySignature(
      modifiers({ readonly: ctx.immutable }),
      propertyIndex(name),
      optional,
      type,
    );
    jsdocComment(header, property);
    headers.push(property);
  }
  headers.push(
    ts.factory.createIndexSignature(
      modifiers({ readonly: ctx.immutable }),
      [
        ts.factory.createParameterDeclaration(
          /* modifiers */ undefined,
          /* dotDotDotToken */ undefined,
          'name',
          /* questionToken */ undefined,
          STRING,
        ),
      ],
      UNKNOWN,
    ),
  );
  members.push(
    ts.factory.createPropertySignature(
      /* modifiers */ undefined,
      propertyIndex('headers'),
      /* questionToken */ undefined,
      ts.factory.createTypeLiteralNode(headers),
    ),
  );

  const content: ts.TypeElement[] = [];
  for (const [contentType, media] of getEntries(response.content, ctx)) {
    const property = ts.factory.createPropertySignature(
      modifiers({ readonly: ctx.immutable }),
      propertyIndex(contentType),
      /* questionToken */ undefined,
      mediaTypeType(media, ctx, createRef([path, 'content', contentType])),
    );
    jsdocComment(media, property);
    content.push(property);
  }
  members.push(
    ts.factory.createPropertySignature(
      /* modifiers */ undefined,
      propertyIndex('content'),
      /* questionToken */ content.length ? undefined : QUESTION_TOKEN,
      content.length ? ts.factory.createTypeLiteralNode(content) : NEVER,
    ),
  );

  members.push(...itemContent(response.content, ctx, path));
  return ts.factory.createTypeLiteralNode(members);
}

/** Header Object: like a parameter, keyed by the header name in its parent. */
export function headerType(header: HeaderObject, ctx: Context, path: string): ts.TypeNode {
  if (header.schema !== undefined) return schemaType(header.schema, ctx, path);

  if (header.content) {
    const members: ts.TypeElement[] = [];
    for (const [contentType, media] of getEntries(header.content, ctx)) {
      const nextPath = `${path}/${escapePointer(contentType)}`;
      const type =
        '$ref' in media ? schemaType(media, ctx, nextPath) : mediaTypeType(media, ctx, nextPath);
      const property = ts.factory.createPropertySignature(
        modifiers({ readonly: ctx.immutable }),
        propertyIndex(contentType),
        /* questionToken */ undefined,
        type,
      );
      jsdocComment(media, property);
      members.push(property);
    }
    return ts.factory.createTypeLiteralNode(members);
  }

  return UNKNOWN;
}
