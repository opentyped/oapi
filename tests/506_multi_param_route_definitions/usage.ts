import type { operations } from './schema.js';
type Read = operations['ReadRepo'];
declare const read: Read;
const org: string = read.parameters.path.org;
const repo: string = read.parameters.path.repo;
// @ts-expect-error Multi-parameter routes keep both parameters required.
const wrong: Read['parameters']['path'] = { org: 'o' };
void [org, repo, wrong];
