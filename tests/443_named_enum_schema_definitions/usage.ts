import type { components } from './schema.js';
type Status = components['schemas']['Status'];
type Task = components['schemas']['Task'];
const status: Status = 'active';
const task: Task = { id: 'a', status };
// @ts-expect-error Named enum schemas keep their literal members.
const wrong: Status = 'pending';
void [status, task, wrong];
