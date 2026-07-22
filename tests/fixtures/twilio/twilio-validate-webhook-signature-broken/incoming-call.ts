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
      },
    },
    async (req, reply) => {
      const response = new VoiceResponse();
      response.say(`Thanks for calling ${req.body.From}`);
      reply.type('text/xml');
      reply.send(response.toString());
    },
  );
};

export default incomingCall;
