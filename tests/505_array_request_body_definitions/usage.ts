import type { operations } from './schema.js';
type Create = operations['createRows'];
declare const create: Create;
const cells: string[] = create.requestBody['content']['application/json'][0].cells;
// @ts-expect-error Array request bodies keep their element contracts.
const wrong: { note: string } = create.requestBody['content']['application/json'][0];
void [cells, wrong];
