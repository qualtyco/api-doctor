const callerConfigMsg = {
  type: 'session.update',
  session: {
    modalities: ['text', 'audio'],
    instructions: 'translate from Spanish to English',
    input_audio_format: 'g711_ulaw',
    output_audio_format: 'g711_ulaw',
    turn_detection: { type: 'server_vad' },
    // Setting temperature to minimum allowed value to get deterministic translation results
    temperature: 0.6,
  },
};

export default callerConfigMsg;
