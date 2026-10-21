import type { paths, operations } from './schema.js';
type Read = paths['/items/{id}']['get'];
declare const read: Read;
const id: string = read.parameters.path.id;
declare const synthesized: operations['getItemsById'];
const synthesizedId: string = synthesized.parameters.path.id;
// @ts-expect-error Path parameters are required.
const empty: Read['parameters']['path'] = {};
// @ts-expect-error Item results are string arrays.
const wrong: Read['responses'][200]['content']['application/json'] = { results: [1] };
void [id, synthesizedId, empty, wrong];
