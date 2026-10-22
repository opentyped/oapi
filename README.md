# OpenTyped OAPI

Utoipa-style OpenAPI generation for TypeScript. Write types and annotated handlers; OpenTyped OAPI reads their AST at build time and emits OpenAPI 3.2, JSON Schema, and client types. It never executes application code to generate a document.

```sh
npm config set @opentyped:registry https://npm.pkg.github.com
npm login --scope=@opentyped --registry=https://npm.pkg.github.com --auth-type=legacy
npm install express @opentyped/express @opentyped/openapi @opentyped/fetch
npm install -D typescript vite @types/express @types/node @opentyped/compiler @opentyped/vite @opentyped/tsgen
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

At runtime, `mount` registers an Express handler. During generation, the parser recognizes the imported wrapper and reads its contract, method, path, and operation ID from the AST. Express parsing is registered explicitly; schema-only and Web API projects need no Express dependency.

## 2. Generate the document

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

Run `npx vite build`, or generate without building the application:

```json
{ "type": "module", "scripts": { "json": "oapi --config oapi.config.ts" } }
```

Run `npm run json`. Generation builds real declarations in memory, then typechecks the whole project before writing output; generated-type consumers can therefore work on the first run with the same tsconfig. The TypeScript checker resolves imported, generic, mapped, union, and recursive types into JSON Schema. `manager?: User` becomes an optional `$ref`, so recursion stays finite. The endpoint parser places params and status-specific responses into the OpenAPI document. Folder namespaces keep unrelated `User` types distinct.

For example, these fields appear in `openapi.json` (excerpt):

```json
{
  "paths": {
    "/users/{id}": {
      "get": {
        "operationId": "getUser",
        "responses": {
          "200": {
            "description": "HTTP 200",
            "content": {
              "application/json": { "schema": { "$ref": "#/components/schemas/models.User" } }
            }
          }
        }
      }
    }
  }
}
```

The full document also contains the path parameter, 404 response, and `models.User` component. Only the two configured output files are written. Ambiguous names and unsupported types fail generation. Serialization mappings, such as Decimal → string, belong in configuration.

## 3. Generate types from the document

Vite and `npm run json` already write `openapi.d.ts`. For an existing OpenAPI JSON file, use `tsgen` independently:

```json
{ "scripts": { "client": "oapi-tsgen openapi.json -o openapi.d.ts --prefix openapi" } }
```

`npm run client` reads the document, not your server source, and emits type-only ambient modules. Conceptually:

```ts
// openapi.d.ts (simplified)
declare module 'openapi/models' {
  export type User = { id: string; name: string; manager?: User };
}
// openapi/api exports GetUserInput, GetUserResponse, GetUserError,
// and schema: a path → method → parameters/body/responses type.
```

The configured namespace determines `openapi/<namespace>`. Each module exports its generated types and reserves `schema` for its own routes. The `openapi` prefix is configurable. Enable `strict` in your tsconfig and include both source and generated declarations:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true
  },
  "include": ["src", "openapi.d.ts"]
}
```

## 4. Use typed Fetch

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

Path and method select params, query, headers, and body types. Use one `body`: objects encode as JSON; `RequestBody` selects other representations. Responses retain native `.text()`, `.blob()`, and streaming `.body`. The client uses the host's Fetch or an injected implementation on Node, Web, or Expo.

## Examples

In this repository, run `npm install && npm run examples:check` to build the packages, generate documents/types, and typecheck every example. Run each example's commands inside its folder.

| Example                                                | What to try                                                                                                                                         |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Schema](examples/schema/accounts/summary.ts)          | `cd examples/schema && npm run check`: recursive models, generic pages, `Pick`, and separate `accounts.User` / `billing.User`.                      |
| [Express](examples/express/api/users.ts)               | `cd examples/express && npm run check && npm run start`: params, query, headers, JSON bodies, 201/404 responses. `npm run build` demonstrates Vite. |
| [Web API](examples/web/routes.ts)                      | `cd examples/web && npm run check && npm run start`: native Request/Response handlers; prints success and validation-error responses.               |
| [Client](examples/client/usage.ts)                     | `cd examples/client && npm run check && npm run start`: JSON document → types → real Fetch calls. Start the Express example first.                  |
| [Content](examples/content/demo.ts)                    | `cd examples/content && npm run check && npm run start`: XML, binary, multipart, and SSE using an in-process Fetch transport.                       |
| [Serialization](examples/serialization/oapi.config.ts) | `cd examples/serialization && npm run check && npm run start`: map `decimal.js` to its string JSON representation without changing model imports.   |

## Package builds

GitHub Actions checks Node 22/24 and uploads all eight npm tarballs as the `npm-packages` artifact. Publishing a GitHub Release (for example `v0.1.0`, matching every package version) publishes `@opentyped/*` to GitHub Packages and attaches the tarballs to the release. Publishing uses the repository’s `GITHUB_TOKEN`; no npm token is needed. GitHub Packages installation requires a personal access token with `read:packages` when logging in above.

Locally: `npm run build && npm run pack:packages`. Packages are written to `.oapi/packages/`; install the downloaded tarballs together with `npm install ./*.tgz` so workspace dependencies resolve locally. Examples are not packaged. Package visibility is managed in GitHub Packages settings.
