import express from 'express';
import oapi from '@opentyped/oapi-express';
import endpoint from './endpoint.js';
import type { Read } from './contracts.js';
export const app = express();
oapi.mount<Read>(app, endpoint.read);
