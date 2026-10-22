# oapi

[![Build](https://github.com/opentyped/oapi/actions/workflows/check.yml/badge.svg)](https://github.com/opentyped/oapi/actions/workflows/check.yml)
[![OpenAPI 3.2](https://img.shields.io/badge/OpenAPI-3.2-6BA539)](https://spec.openapis.org/oas/v3.2.0.html)
[![GitHub Packages](https://img.shields.io/badge/packages-%40opentyped-blue)](https://github.com/orgs/opentyped/packages?repo_name=oapi)

Utoipa-inspired OpenAPI generation for TypeScript. Reads types and route annotations from the AST at build time to generate an OpenAPI document and TypeScript declarations.

```sh
npm config set @opentyped:registry https://npm.pkg.github.com
npm login --scope=@opentyped --registry=https://npm.pkg.github.com --auth-type=legacy
npm install express @opentyped/express @opentyped/openapi @opentyped/fetch
npm install -D typescript vite @types/express @types/node @opentyped/compiler @opentyped/vite
```

GitHub Packages login requires a token with `read:packages`.

## 1. Write models and handlers

```ts
// src/models/user.ts
/** @schema */
export interface User {
  id: string;
  name: string;
  manager?: User;
}
```

```ts
// src/api/users.ts
import express from 'express';
import oapi from '@opentyped/express';
import type { User } from '../models/user';

const app = express();
oapi.mount<{
  params: { id: string };
  responses: { 200: { body: User }; 404: { body: { message: string } } };
}>(app, {
  method: 'GET',
  path: '/users/:id',
  operationId: 'getUser',
  handler(request, response) {
    if (request.params.id === 'missing')
      return response.status(404).json({ message: 'User not found' });
    return response.json({ id: request.params.id, name: 'Ada' });
  },
});
app.listen(3000);
```

`mount` registers the Express handler and provides its types to the generator.

## 2. Generate JSON and declarations

```ts
// oapi.config.ts
import { defineConfig } from '@opentyped/compiler';
import { defaultParsers } from '@opentyped/vite';
import { ExpressParser } from '@opentyped/express/parser';

export default defineConfig({
  tsconfig: './tsconfig.json',
  info: { title: 'Users', version: '1.0.0' },
  namespaces: { './src/models/**/*.ts': 'models', './src/api/**/*.ts': 'api' },
  parsers: [...defaultParsers(), new ExpressParser()],
  output: { document: 'openapi.json', declarations: 'openapi.d.ts' },
  prefix: 'openapi',
});
```

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { openapi } from '@opentyped/vite';
import generation from './oapi.config';

export default defineConfig({
  plugins: [openapi(generation)],
  build: { ssr: 'src/api/users.ts' },
});
```

Run `npx vite build`. It writes `openapi.json` and `openapi.d.ts` to the configured paths. Include the declaration file in your tsconfig and enable `strict`.

Namespace globs determine imports: `models` → `openapi/models`, `api` → `openapi/api`. The `prefix` option changes `openapi`.

## 3. Use typed Fetch

```ts
import { createClient } from '@opentyped/fetch';
import type { User } from 'openapi/models';
import type { schema } from 'openapi/api';

const client = createClient<schema>({ baseUrl: 'http://localhost:3000' });
const response = await client('/users/{id}', { params: { id: '42' } });
if (response.status === 200) {
  const user: User = await response.json();
  console.log(user.name);
} else if (response.status === 404) {
  console.log((await response.json()).message);
}
```

Path and method determine parameter, body, and response types. Supports JSON, other content types, and native response streams on Node, Web, and Expo.

## Examples

- [Schema](examples/schema): recursive types, generics, namespaces.
- [Express](examples/express): typed routes and Vite integration.
- [Web API](examples/web): native Request/Response handlers.
- [Client](examples/client): OpenAPI JSON → types → Fetch.
- [Content](examples/content): XML, binary, multipart, SSE.
- [Serialization](examples/serialization): Decimal → string mapping.
