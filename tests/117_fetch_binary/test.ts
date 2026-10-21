import { webHandler } from '@typedapi/openapi/contract';

interface Download {
  query: { buffer?: boolean };
  responses: {
    200: {
      /**
       * @asType string
       * @format binary
       */
      body: Uint8Array | ArrayBuffer;
      contentType: 'application/octet-stream';
    };
  };
}
/** @route GET /bytes */
export const bytes = webHandler<Download>((request) => {
  const data = new Uint8Array([0, 128, 255]);
  return {
    status: 200,
    contentType: 'application/octet-stream',
    body: new URL(request.url).searchParams.get('buffer') === 'true' ? data.buffer : data,
  };
});

interface BlobDownload {
  responses: {
    200: {
      /**
       * @asType string
       * @format binary
       */
      body: Blob;
      contentType: 'application/octet-stream';
    };
  };
}
/** @route GET /blob */
export const blob = webHandler<BlobDownload>(() => ({
  status: 200,
  contentType: 'application/octet-stream',
  body: new Blob(['blob'], { type: 'application/octet-stream' }),
}));
