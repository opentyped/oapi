import type { webhooks, operations } from './schema.js';
type Created = operations['UserCreated'];
declare const created: Created;
const body: { id: string } = created.requestBody['content']['application/json'];
declare const hook: webhooks['user/created'];
const viaHook: typeof created = hook.post;
// @ts-expect-error Webhook payloads keep their declared shape.
const wrong: { note: string } = created.requestBody['content']['application/json'];
void [body, viaHook, wrong];
