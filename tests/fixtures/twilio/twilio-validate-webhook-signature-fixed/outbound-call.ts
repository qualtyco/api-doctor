import { FastifyPluginAsync } from 'fastify';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';
import { RequestValidator } from 'twilio';

// Looks like there's no validation right at the route, but the file uses
// the class-based RequestValidator form instead of twilio.validateRequest().
const outboundCall: FastifyPluginAsync = async (server) => {
  const validator = new RequestValidator(server.config.TWILIO_AUTH_TOKEN);

  server.addHook('preHandler', (req, reply, done) => {
    const signature = req.headers['x-twilio-signature'] as string;
    const url = `https://${server.config.NGROK_DOMAIN}${req.url}`;
    if (!validator.validate(url, req.body as Record<string, string>, signature)) {
      return reply.status(403).send('Invalid signature');
    }
    done();
  });

  server.post('/outbound-call', {}, async (req, reply) => {
    const response = new VoiceResponse();
    response
      .enqueue({ workflowSid: server.config.TWILIO_FLEX_WORKFLOW_SID })
      .task(JSON.stringify({ name: req.body.Caller, type: 'inbound' }));
    reply.type('text/xml');
    reply.send(response.toString());
  });
};

export default outboundCall;
