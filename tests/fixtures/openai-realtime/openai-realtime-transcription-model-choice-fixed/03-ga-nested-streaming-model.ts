// GA session shape with the natively-streaming transcription model — the
// nested audio.input.transcription config is fine when it isn't whisper-1.
const gaConfigMsg = {
  type: 'session.update',
  session: {
    type: 'realtime',
    audio: {
      input: {
        format: { type: 'audio/pcmu' },
        transcription: { model: 'gpt-realtime-whisper' },
      },
    },
  },
};

export default gaConfigMsg;
