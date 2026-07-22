import { Type } from '@fastify/type-provider-typebox';
import { FastifyPluginAsync } from 'fastify';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';

const incomingCall: FastifyPluginAsync = async (server) => {
  server.post(
    '/incoming-call',
    {
      schema: {
        body: Type.Object({
          From: Type.String(),
          To: Type.String(),
          CallSid: Type.String(),
        }),
        querystring: Type.Object({
          lang: Type.String(),
        }),
      },
    },
    async (req, reply) => {
      const response = new VoiceResponse();
      const connect = response.connect();
      const stream = connect.stream({ name: 'Example Audio Stream', url: 'wss://example.com/intercept' });
      stream.parameter({ name: 'lang', value: req.query.lang });
      reply.type('text/xml');
      reply.send(response.toString());
    },
  );
};

export default incomingCall;
