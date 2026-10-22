import express from 'express';
import oapi from '@opentyped/express';

interface Filter {
  terms: string[];
  next?: Filter;
}
interface Search {
  query: {
    /** @http {"contentType":"application/json","example":{"terms":["name"]}} */
    filter?: Filter;
  };
  responses: {
    204: {
      headers: {
        /** @http {"contentType":"application/json"} */
        'X-Filter': Filter;
      };
    };
  };
}
express().get(
  '/search',
  oapi.handler<Search>({
    operationId: 'search',
    handler(_request, response) {
      response.status(204).end();
    },
  }),
);
