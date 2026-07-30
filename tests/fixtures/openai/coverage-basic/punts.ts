import { openai } from './lib/openai';

// A bare reference is not a call — models.list must not be recorded.
export const listModelsRef = openai.models.list;

// Destructured resources are a documented punt — files.list must not be recorded.
const { files } = openai;

export async function listFiles() {
  return files.list();
}

// Right call shape on the wrong root — must not be recorded (and not counted as unknown).
const responseCache = { responses: { retrieve: async (_id: string) => ({}) } };

export async function cachedResponse(id: string) {
  return responseCache.responses.retrieve(id);
}

// Low-level transport escape hatch on a verified client: never in `used`,
// counted once in unknownSdkCalls.
export async function rawUsage() {
  return openai.get('/organization/usage/completions');
}
