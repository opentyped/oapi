import type { Model, ModelChildren, schema } from 'openapi/models';
import { createClient } from '@opentyped/fetch';
const children: ModelChildren = [];
const model: Model = { name: 'root', children };
children.push(model);
const client = createClient<schema>();
void client('/selected', { method: 'POST', body: { value: children } });
void client('/selected', { method: 'POST', body: { value: 'leaf' } });
// @ts-expect-error Recursive helpers preserve their element types.
const wrong: ModelChildren = ['leaf'];
// @ts-expect-error The request retains its generic return constraint.
void client('/selected', { method: 'POST', body: { value: 42 } });
void wrong;
