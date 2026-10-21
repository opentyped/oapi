import type { operations } from './schema.js';

type Operation = operations['createPayment'];
type Input = Operation['requestBody']['content']['application/json'];
type Output = Operation['responses'][201]['content']['application/json'];
const input: Input = { amount: '123.45' };
const output: Output = input;
// @ts-expect-error Request payloads use the configured string representation.
const invalid: Input = { amount: 123.45 };
void [input, output, invalid];
