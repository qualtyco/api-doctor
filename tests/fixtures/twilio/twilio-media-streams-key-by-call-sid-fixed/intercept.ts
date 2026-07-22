import AudioInterceptor from '@/services/AudioInterceptor';
import StreamSocket, { StartBaseAudioMessage } from '@/services/StreamSocket';

export function registerStartHandler(ss: StreamSocket, map: Map<string, AudioInterceptor>) {
  ss.onStart(async (message: StartBaseAudioMessage) => {
    const { customParameters } = message.start;
    const callSid = message.start.callSid;

    if (customParameters?.direction === 'inbound' && typeof customParameters.from === 'string') {
      const interceptor = new AudioInterceptor({ logger: console as any, config: {} as any, callerLanguage: 'en' });
      map.set(callSid, interceptor);
      console.log('Added interceptor for callSid', callSid);
    }
  });
}
