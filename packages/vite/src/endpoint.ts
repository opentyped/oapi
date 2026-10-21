import type { Connect } from 'vite';
import { stableJson } from '@typedapi/openapi/json';
import type { DocumentSnapshot } from '~/snapshot';

/** Read-only development transport for generated documents. */
export class DocumentEndpoint {
  private readonly prefix: string;

  constructor(
    base: string,
    directory: string,
    private readonly snapshot: DocumentSnapshot,
  ) {
    this.prefix = `${base.replace(/\/$/, '')}/${directory}/`;
  }

  handle: Connect.NextHandleFunction = (request, response, next) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith(this.prefix)) return next();
    const file = url.pathname.slice(this.prefix.length);
    const content = this.snapshot.content(file);
    if (file !== 'openapi.json' && content === undefined) return next();
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.statusCode = 405;
      response.setHeader('Allow', 'GET, HEAD');
      return response.end();
    }
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    const failure = this.snapshot.failure;
    response.statusCode = failure || content === undefined ? 503 : 200;
    response.end(
      request.method === 'HEAD'
        ? undefined
        : stableJson(failure ? { error: failure.message } : content),
    );
  };
}
