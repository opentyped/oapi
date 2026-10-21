import type { Price, Tree } from 'openapi/models';
const price: Price = '123.45';
const leaf: Tree = { kind: 'leaf', price };
const tree: Tree = { kind: 'branch', children: [leaf] };
if (tree.kind === 'branch') tree.children.push(tree);
// @ts-expect-error Decimal values serialize as strings in generated models.
const invalid: Price = 123;
// @ts-expect-error Discriminated recursive variants retain their required fields.
const incomplete: Tree = { kind: 'leaf' };
void [price, leaf, tree, invalid, incomplete];
