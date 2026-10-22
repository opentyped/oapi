import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';
import type { UserRepository, UserRecord } from './repository.js';

declare const app: Router;
declare const repository: UserRepository;
interface ReadStoredUser {
  params: { id: string };
  responses: {
    200: { body: UserRecord };
    404: { body: { message: string } };
  };
}
oapi.mount<ReadStoredUser>(app, {
  method: 'GET',
  path: '/stored-users/:id',
  operationId: 'getStoredUser',
  async handler(request, response) {
    const user = await repository.find(request.params.id);
    if (!user) return response.status(404).json({ message: 'User not found' });
    return response.json(user);
  },
});
