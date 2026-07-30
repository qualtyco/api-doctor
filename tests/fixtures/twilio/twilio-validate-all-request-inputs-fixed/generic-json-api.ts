import { FastifyPluginAsync } from 'fastify';
import { createUser } from './user-service';

// False-positive regression (audit: 81/89 FPs): a schema-less POST route
// reading req.body fields with zero Twilio evidence — an ordinary JSON API
// endpoint. The rule targets Twilio webhook routes only and must not fire
// on generic routes just because they lack a Fastify schema.
const signup: FastifyPluginAsync = async (server) => {
  server.post('/signup', {}, async (req: any, reply) => {
    const user = await createUser(req.body.username, req.body.email);
    reply.status(201).send({ id: user.id });
  });
};

export default signup;
