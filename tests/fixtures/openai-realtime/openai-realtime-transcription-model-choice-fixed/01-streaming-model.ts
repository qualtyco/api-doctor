const callerConfigMsg = {
  type: 'session.update',
  session: {
    modalities: ['text', 'audio'],
    input_audio_format: 'g711_ulaw',
    output_audio_format: 'g711_ulaw',
    input_audio_transcription: { model: 'gpt-realtime-whisper' },
    turn_detection: { type: 'server_vad' },
  },
};

export default callerConfigMsg;
