import { findProperty } from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: "OpenAI Realtime sessions should not configure 'whisper-1' for input transcription",
      category: 'correctness',
      docsUrl: 'https://developers.openai.com/api/docs/guides/realtime-transcription',
      rationale:
        "OpenAI's transcription guidance describes 'whisper-1' as for existing Whisper integrations that are not natively streaming, while 'gpt-realtime-whisper' is the natively-streaming option designed for realtime sessions. Configuring input_audio_transcription with 'whisper-1' is the wrong tool for a realtime session, adding latency/cost to a streaming pipeline.",
      recommended: true,
    },
    messages: {
      nonStreamingTranscriptionModel:
        "input_audio_transcription is configured with 'whisper-1', which is not natively streaming and not optimized for realtime sessions.",
    },
    schema: [],
  },
  create(context: any) {
    return {
      ObjectExpression(node: any) {
        const typeProp = findProperty(node, 'type');
        const typeValue = typeProp?.value;
        const isSessionUpdate =
          typeValue?.type === 'Literal' && typeof typeValue.value === 'string' && typeValue.value === 'session.update';
        if (!isSessionUpdate) return;

        const sessionProp = findProperty(node, 'session');
        if (sessionProp?.value?.type !== 'ObjectExpression') return;

        const transcriptionProp = findProperty(sessionProp.value, 'input_audio_transcription');
        if (transcriptionProp?.value?.type !== 'ObjectExpression') return;

        const modelProp = findProperty(transcriptionProp.value, 'model');
        const modelValue = modelProp?.value;
        const isWhisper1 =
          modelValue?.type === 'Literal' && typeof modelValue.value === 'string' && modelValue.value === 'whisper-1';
        if (!isWhisper1) return;

        context.report({ node: modelProp, messageId: 'nonStreamingTranscriptionModel' });
      },
    };
  },
};

export const openaiRealtimeTranscriptionModelChoiceRule = rule;
