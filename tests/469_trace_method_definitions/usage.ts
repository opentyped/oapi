import type { operations } from './schema.js';
type Echo = operations['Echo'];
declare const echo: Echo;
const echoed: boolean = echo.responses[200]['content']['application/json'].echoed;
// @ts-expect-error TRACE responses keep their declared contracts.
const wrong: { note: string } = echo.responses[200]['content']['application/json'];
void [echoed, wrong];
