import { Type } from '@fastify/type-provider-typebox';
import { FastifyPluginAsync } from 'fastify';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';
import twilio from 'twilio';

const incomingCall: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', (req, reply, done) => {
    const signature = req.headers['x-twilio-signature'] as string;
    const url = `https://${server.config.NGROK_DOMAIN}${req.url}`;
    const valid = twilio.validateRequest(
      server.config.TWILIO_AUTH_TOKEN,
      signature,
      url,
      req.body as Record<string, string>,
    );
    if (!valid) return reply.status(403).send('Invalid signature');
    done();
  });

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
