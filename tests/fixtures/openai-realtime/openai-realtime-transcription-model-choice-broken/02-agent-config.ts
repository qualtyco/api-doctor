function buildAgentConfigMsg(agentPrompt: string) {
  return {
    type: 'session.update',
    session: {
      modalities: ['text', 'audio'],
      instructions: agentPrompt,
      input_audio_transcription: {
        model: 'whisper-1',
      },
      turn_detection: { type: 'server_vad' },
    },
  };
}

export default buildAgentConfigMsg;
