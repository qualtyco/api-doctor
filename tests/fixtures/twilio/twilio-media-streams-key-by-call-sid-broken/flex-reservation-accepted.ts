import { FastifyPluginAsync } from 'fastify';
import AudioInterceptor from '@/services/AudioInterceptor';

const flexReservationAccepted: FastifyPluginAsync = async (server) => {
  server.post('/reservation-accepted', {}, async (req, res) => {
    const callSid = req.body.CallSid;
    server.log.info(`TaskRouter reservation accepted for CallSid ${callSid}`);
    const { from } = JSON.parse(req.body.TaskAttributes);
    const map = req.diScope.resolve<Map<string, AudioInterceptor>>('audioInterceptors');

    const audioInterceptor = map.get(from);
    if (!audioInterceptor) {
      res.status(404).send('Not Found');
      return;
    }
    audioInterceptor.start();
    res.status(200).send('OK');
  });
};

export default flexReservationAccepted;
