import type { User, schema } from '@app/generated/models';
import { createClient, RequestBody } from '@opentyped/oapi-fetch';
export const user: User = { id: '1' };
const client = createClient<schema>();
void client('/users/{id}', { params: { id: user.id } });
void client('/documents', {
  method: 'POST',
  body: RequestBody.fromText('<user />', 'application/xml'),
});
// @ts-expect-error Real declarations, not any placeholders, must be used for validation.
export const wrong: User = { id: 1 };
// @ts-expect-error Required path parameters must remain required on the first generation.
void client('/users/{id}');
// @ts-expect-error XML endpoints do not accept a JSON payload.
void client('/documents', { method: 'POST', body: { id: '1' } });
