import ts from 'typescript';
import { createRef } from '~/pointer';
import { modifiers, propertyIndex } from '~/ast';
import { getEntries } from '~/resolve';
import { pathItemType } from '~/transform/paths';
import type { Context } from '~/context';
import type { PathItemObject, WebhooksObject } from '~/types';

/** Webhooks Object: named path items, shaped like the Paths Object. */
export function webhooksType(webhooks: WebhooksObject, ctx: Context): ts.TypeNode {
  const members: ts.TypeElement[] = [];
  for (const [name, pathItem] of getEntries(webhooks, ctx)) {
    members.push(
      ts.factory.createPropertySignature(
        modifiers({ readonly: ctx.immutable }),
        propertyIndex(name),
        /* questionToken */ undefined,
        pathItemType(pathItem as PathItemObject, ctx, createRef(['webhooks', name])),
      ),
    );
  }
  return ts.factory.createTypeLiteralNode(members);
}
