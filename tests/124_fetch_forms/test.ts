import { webHandler } from '@opentyped/openapi/contract';

interface Encoded {
  responses: {
    200: {
      /** @jsonSchema {"type":"object","properties":{"label":{"type":"string"},"tag":{"type":"array","items":{"type":"string"}}},"required":["label","tag"],"additionalProperties":false} */
      body: URLSearchParams;
      contentType: 'application/x-www-form-urlencoded';
    };
  };
}
/** @route GET /encoded */
export const encoded = webHandler<Encoded>(() => ({
  status: 200,
  contentType: 'application/x-www-form-urlencoded',
  body: new URLSearchParams([
    ['label', 'hello world'],
    ['tag', 'a'],
    ['tag', 'b'],
  ]),
}));

interface Multipart {
  responses: {
    200: {
      /** @jsonSchema {"type":"object","properties":{"label":{"type":"string"},"file":{"type":"string","format":"binary"}},"required":["label","file"],"additionalProperties":false} */
      body: FormData;
      contentType: 'multipart/form-data';
    };
  };
}
/** @route GET /multipart */
export const multipart = webHandler<Multipart>(() => {
  const body = new FormData();
  body.append('label', 'hello world');
  body.append('file', new Blob([new Uint8Array([0, 128, 255])]), 'data.bin');
  return { status: 200, contentType: 'multipart/form-data', body };
});
