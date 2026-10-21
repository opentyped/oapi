import type { operations } from './schema.js';
type List = operations['listTags'];
declare const list: List;
const tags: string[] = list.responses[200]['content']['application/json'];
// @ts-expect-error Array bodies keep their element contracts.
const wrong: { note: string } = list.responses[200]['content']['application/json'];
void [tags, wrong];
