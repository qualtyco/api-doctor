import { FastifyPluginAsync } from 'fastify';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';

export const outboundCall: FastifyPluginAsync = async (server) => {
  server.post('/outbound-call', {}, async (req, reply) => {
    const response = new VoiceResponse();
    response
      .enqueue({ workflowSid: server.config.TWILIO_FLEX_WORKFLOW_SID })
      .task(JSON.stringify({ name: req.body.Caller, type: 'inbound' }));
    reply.send(response.toString());
  });
};

export const flexReservationAccepted: FastifyPluginAsync = async (server) => {
  server.post('/reservation-accepted', {}, async (req, res) => {
    const { from } = JSON.parse(req.body.TaskAttributes);
    const audioInterceptor = req.diScope.resolve('audioInterceptors').get(from);
    if (!audioInterceptor) {
      res.status(404).send('Not Found');
      return;
    }
    audioInterceptor.start();
    res.status(200).send('OK');
  });
};
