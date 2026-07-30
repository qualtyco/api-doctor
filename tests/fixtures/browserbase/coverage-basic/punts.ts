import { bb } from './lib/browserbase';

// A bare reference is not a call — sessions.debug must not be recorded.
export const debugRef = bb.sessions.debug;

// Destructured resources are a documented punt — sessions.list must not be recorded.
const { sessions } = bb;

export async function listSessions() {
  return sessions.list();
}

// Right call shape on the wrong root — must not be recorded (and not counted as unknown).
const replayStore = { sessions: { retrieve: async (_id: string) => ({}) } };

export async function cachedSession(id: string) {
  return replayStore.sessions.retrieve(id);
}

// Low-level transport escape hatch on a verified client: never in `used`,
// counted once in unknownSdkCalls.
export async function rawList() {
  return bb.get('/v1/sessions');
}
