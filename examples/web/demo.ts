import { echo } from './routes';

// No server or framework: invoke the handler with a standard Request.
for (const body of [{ name: 'Ada' }, {}]) {
  const response = await echo(
    new Request('https://example.test/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  console.log(response.status, await response.json());
}
