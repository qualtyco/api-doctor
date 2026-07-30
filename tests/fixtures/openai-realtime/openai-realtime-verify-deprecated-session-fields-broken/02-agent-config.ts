export const REALTIME_WS_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview';

function buildAgentConfigMsg(agentPrompt: string) {
  return {
    type: 'session.update',
    session: {
      modalities: ['text', 'audio'],
      instructions: agentPrompt,
      input_audio_format: 'g711_ulaw',
      output_audio_format: 'g711_ulaw',
      turn_detection: { type: 'server_vad' },
      temperature: 0.6,
    },
  };
}

export default buildAgentConfigMsg;
