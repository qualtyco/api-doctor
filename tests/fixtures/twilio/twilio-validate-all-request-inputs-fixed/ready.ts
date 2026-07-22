import { FastifyPluginAsync } from 'fastify';

// Looks suspicious because there's no schema object at all on this POST
// route, but the handler never reads req.body or req.query — a bare health
// check has nothing to validate.
const ready: FastifyPluginAsync = async (server) => {
  server.post('/ready', {}, async (_req, reply) => {
    reply.status(200).send('OK');
  });
};

export default ready;
