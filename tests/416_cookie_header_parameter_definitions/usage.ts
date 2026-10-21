import type { operations } from './schema.js';
type Read = operations['readPreferences'];
declare const read: Read;
const trace: string = read.parameters.header['X-Trace'];
const session: string = read.parameters.cookie.session;
const theme: 'dark' | 'light' | undefined = read.parameters.cookie.theme;
// @ts-expect-error Optional header parameters include undefined.
const missing: string = read.parameters.header['X-Mode'];
void [trace, session, theme, missing];
