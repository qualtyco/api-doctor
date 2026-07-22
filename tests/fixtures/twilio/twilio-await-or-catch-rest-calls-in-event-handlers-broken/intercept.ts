import Twilio from 'twilio';
import StreamSocket, { StartBaseAudioMessage } from '@/services/StreamSocket';

export function registerStartHandler(ss: StreamSocket, twilio: ReturnType<typeof Twilio>, config: { TWILIO_CALLER_NUMBER: string; TWILIO_FLEX_NUMBER: string }) {
  ss.onStart(async (message: StartBaseAudioMessage) => {
    const { customParameters } = message.start;
    if (customParameters?.direction === 'inbound') {
      await twilio.calls.create({
        from: config.TWILIO_CALLER_NUMBER,
        to: config.TWILIO_FLEX_NUMBER,
        twiml: '<Response></Response>',
      });
    }
  });
}
