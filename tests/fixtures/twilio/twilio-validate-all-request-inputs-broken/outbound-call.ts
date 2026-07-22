import { FastifyPluginAsync } from 'fastify';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';

const outboundCall: FastifyPluginAsync = async (server) => {
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
