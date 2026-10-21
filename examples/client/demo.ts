import { createUser, getUser } from './usage';

// Start examples/express first: this client only knows openapi.json.
console.log(await createUser('Ada'));
console.log(await getUser('42'));
console.log(await getUser('missing'));
