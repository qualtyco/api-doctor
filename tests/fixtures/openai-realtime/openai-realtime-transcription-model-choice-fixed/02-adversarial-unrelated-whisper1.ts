// Adversarial: 'whisper-1' appears inside an `input_audio_transcription`
// shape, but the outer object isn't a Realtime session.update payload (the
// `type` discriminant doesn't match), so this is out of scope for the rule.
const batchTranscriptionJob = {
  type: 'batch.transcription.create',
  session: {
    input_audio_transcription: { model: 'whisper-1' },
  },
};

export default batchTranscriptionJob;
