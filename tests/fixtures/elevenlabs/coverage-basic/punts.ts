import { elevenlabs } from './lib/elevenlabs';

// A bare reference is not a call — dubbing.create must not be recorded.
export const dubRef = elevenlabs.dubbing.create;

// Destructured resources are a documented punt — voices.getAll must not be recorded.
const { voices } = elevenlabs;

export async function listVoices() {
  return voices.getAll();
}

// Right shape, wrong root — textToSpeech.convert on a plain object must not be recorded.
const localTts = { textToSpeech: { convert: () => new Uint8Array() } };

export function synthesizeOffline() {
  return localTts.textToSpeech.convert();
}
