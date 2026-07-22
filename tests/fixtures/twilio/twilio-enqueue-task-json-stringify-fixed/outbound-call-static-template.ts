import { FastifyPluginAsync } from 'fastify';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';

// Looks suspicious because it's a template literal next to `.task()`, but
// there is no interpolated request data in it at all — it's a static JSON
// string, so there's nothing for an attacker-controlled value to break.
const outboundCall: FastifyPluginAsync = async (server) => {
  server.post('/outbound-call', {}, async (_req, reply) => {
    const response = new VoiceResponse();
    response
      .enqueue({ workflowSid: server.config.TWILIO_FLEX_WORKFLOW_SID })
      .task(`{ "name": "unknown", "type": "inbound" }`);
    reply.type('text/xml');
    reply.send(response.toString());
  });
};

export default outboundCall;
