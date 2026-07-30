import { ElevenLabsClient as SpeechSdk } from '@elevenlabs/elevenlabs-js';

const client = new SpeechSdk({ apiKey: process.env.ELEVENLABS_API_KEY });

export async function narrate(voiceId: string, text: string) {
  return client.textToSpeech.convert(voiceId, {
    text,
    modelId: 'eleven_multilingual_v2',
    outputFormat: 'mp3_44100_128',
  });
}
