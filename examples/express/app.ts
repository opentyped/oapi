import express from 'express';
import { users } from './api/users';

const app = express();
app.use(express.json());
users(app);
export default app;
