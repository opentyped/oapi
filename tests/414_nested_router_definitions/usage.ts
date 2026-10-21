import type { paths, operations } from './schema.js';
type Read = operations['readApiUser'];
declare const read: Read;
const id: string = read.parameters.path.id;
type User = paths['/api/users/{id}']['get']['responses'][200]['content']['application/json'];
const user: User = { id: 'one' };
// @ts-expect-error Path parameters are required.
const empty: Read['parameters']['path'] = {};
void [id, user, empty];
