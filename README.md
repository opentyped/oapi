# oapi

[![Build](https://github.com/opentyped/oapi/actions/workflows/check.yml/badge.svg)](https://github.com/opentyped/oapi/actions/workflows/check.yml)
[![OpenAPI 3.2](https://img.shields.io/badge/OpenAPI-3.2-6BA539)](https://spec.openapis.org/oas/v3.2.0.html)
[![npm](https://img.shields.io/npm/v/@opentyped/oapi-vite)](https://www.npmjs.com/package/@opentyped/oapi-vite)

Utoipa-inspired OpenAPI generation for TypeScript. Reads types and route annotations from the AST at build time to generate an OpenAPI document and TypeScript declarations.

```sh
npm install express @opentyped/oapi-express @opentyped/oapi-openapi @opentyped/oapi-fetch
npm install -D typescript vite @types/express @types/node @opentyped/oapi-compiler @opentyped/oapi-vite
```

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

`@schema` exports the type as JSON Schema under `components.schemas` (`models.User` here). Properties become schema fields; recursive types use `$ref`.

```ts
// src/api/users.ts
import express from 'express';
import oapi from '@opentyped/oapi-express';
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

`mount` registers the Express handler at runtime. The AST parser reads the wrapper call at build time:

- `method: 'GET'` and `path: '/users/:id'` → `paths['/users/{id}'].get`.
- `operationId` → the operation’s identifier.
- Contract `params`, `query`, and `headers` → parameters; `body` → request body; `responses` → status-specific response schemas referencing `models.User`.

For documentation without a wrapper, annotate a contract with `@route`:

```ts
/**
 * @route GET /users/{id}
 * @operationId getUser
 */
export interface GetUser {
  params: { id: string };
  responses: { 200: { body: User } };
}
```

`@route` generates an OpenAPI operation; it does not register a runtime handler. The Express wrapper already supplies this metadata, so it needs no `@route` tag.

## 2. Generate JSON and declarations

```ts
// oapi.config.ts
import { defineConfig } from '@opentyped/oapi-compiler';
import { defaultParsers } from '@opentyped/oapi-vite';
import { ExpressParser } from '@opentyped/oapi-express/parser';

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
import { openapi } from '@opentyped/oapi-vite';
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
import { createClient } from '@opentyped/oapi-fetch';
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

## npm releases

Branch pushes and pull requests run `npm run check`. Pushing a `vX.Y.Z` tag
sets all publishable workspace versions and internal dependencies from the tag,
runs the checks, and publishes validated tarballs to npm. Prerelease tags such
as `v1.0.0-beta.1` use npm's `next` dist-tag; stable versions use `latest`.
Configure the repository Actions secret `NPM_TOKEN` with npm publishing access
to `@opentyped`. Credentials are supplied only to the publish step.

```sh
git tag v0.5.0
git push origin HEAD
git push origin v0.5.0
```

Use a new version for every release; npm versions cannot be overwritten.
