import ts from 'typescript';
import type { TypeLiteralNode } from 'typescript';
import { modifiers, NEVER, recordType, STRING } from '~/ast';
import { createRef } from '~/pointer';
import { componentsNodes } from '~/transform/components';
import { pathsType } from '~/transform/paths';
import { schemaType } from '~/transform/schema';
import { webhooksType } from '~/transform/webhooks';
import type { Context } from '~/context';
import type { Document } from '~/types';

/**
 * Assemble the declaration file: the root interfaces in spec order, then the
 * footer (operation definitions, schema aliases, injected helpers).
 */
export function documentNodes(document: Document, ctx: Context): ts.Node[] {
  const nodes: ts.Node[] = [];
  emitRoot(
    nodes,
    'paths',
    document.paths && typeof document.paths === 'object'
      ? [pathsType(document.paths, ctx)]
      : undefined,
  );
  emitRoot(
    nodes,
    'webhooks',
    document.webhooks && typeof document.webhooks === 'object'
      ? [webhooksType(document.webhooks, ctx)]
      : undefined,
  );
  emitRoot(
    nodes,
    'components',
    document.components && typeof document.components === 'object'
      ? componentsNodes(document.components, ctx)
      : undefined,
  );
  emitRoot(
    nodes,
    '$defs',
    document.$defs && typeof document.$defs === 'object'
      ? [schemaType({ type: 'object', properties: document.$defs }, ctx, createRef(['$defs']))]
      : undefined,
  );

  let hasOperations = false;
  for (const node of ctx.injectFooter) {
    if (
      !hasOperations &&
      ts.isInterfaceDeclaration(node) &&
      node.name.escapedText === 'operations'
    ) {
      hasOperations = true;
    }
    nodes.push(node);
  }
  if (!hasOperations) {
    nodes.push(
      ts.factory.createTypeAliasDeclaration(
        modifiers({ export: true }),
        'operations',
        /* typeParameters */ undefined,
        recordType(STRING, NEVER),
      ),
    );
  }
  return nodes;
}

/** Emit one root as an interface, or `Record<string, never>` when it is empty. */
function emitRoot(nodes: ts.Node[], name: string, subTypes: ts.Node[] | undefined): void {
  const empty = ts.factory.createTypeAliasDeclaration(
    modifiers({ export: true }),
    name,
    /* typeParameters */ undefined,
    recordType(STRING, NEVER),
  );
  if (!subTypes) {
    nodes.push(empty);
    return;
  }
  for (const subType of subTypes) {
    const members = ts.isTypeNode(subType) ? (subType as TypeLiteralNode).members : undefined;
    if (members?.length) {
      nodes.push(
        ts.factory.createInterfaceDeclaration(
          modifiers({ export: true }),
          name,
          /* typeParameters */ undefined,
          /* heritageClauses */ undefined,
          members,
        ),
      );
    } else if (ts.isTypeAliasDeclaration(subType)) {
      nodes.push(subType);
    } else {
      nodes.push(empty);
    }
  }
}
