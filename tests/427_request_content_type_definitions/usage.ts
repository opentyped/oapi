import type { operations } from './schema.js';
type Submit = operations['submitForm'];
declare const submit: Submit;
const name: string = submit.requestBody['content']['application/x-www-form-urlencoded'].name;
// @ts-expect-error Form bodies keep their declared fields.
const wrong: { note: string } = submit.requestBody['content']['application/x-www-form-urlencoded'];
void [name, wrong];
