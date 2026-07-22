// Distinct manifestation: the GA session shape, with the transcription
// config nested under session.audio.input instead of the flat
// input_audio_transcription field.
const gaConfigMsg = {
  type: 'session.update',
  session: {
    type: 'realtime',
    audio: {
      input: {
        format: { type: 'audio/pcmu' },
        transcription: { model: 'whisper-1' },
      },
    },
  },
};

export default gaConfigMsg;
