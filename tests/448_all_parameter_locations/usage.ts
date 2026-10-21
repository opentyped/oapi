import type { operations } from './schema.js';
type Read = operations['ReadAudit'];
declare const read: Read;
const id: string = read.parameters.path.id;
const verbose: boolean | undefined = read.parameters.query?.verbose;
const auditor: string = read.parameters.header['X-Auditor'];
const session: string = read.parameters.cookie.session;
// @ts-expect-error Locations are named and typed distinctly.
const wrong: boolean = read.parameters.header['X-Auditor'];
void [id, verbose, auditor, session, wrong];
