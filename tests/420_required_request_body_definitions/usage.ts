import type { operations } from './schema.js';
type Create = operations['createItem'];
declare const create: Create;
const title: string = create.requestBody['content']['application/json'].title;
// @ts-expect-error Required request bodies reject undefined.
const missing: Create['requestBody'] = undefined;
void [title, missing];
