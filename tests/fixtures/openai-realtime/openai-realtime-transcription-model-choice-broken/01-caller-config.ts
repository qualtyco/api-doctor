export const REALTIME_WS_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview';

const callerConfigMsg = {
  type: 'session.update',
  session: {
    modalities: ['text', 'audio'],
    input_audio_format: 'g711_ulaw',
    output_audio_format: 'g711_ulaw',
    input_audio_transcription: { model: 'whisper-1' },
    turn_detection: { type: 'server_vad' },
  },
};

export default callerConfigMsg;
