import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

// A project's own session cache using the same method names, in a file that
// also holds a real Browserbase client. The receiver is `store`, so none of
// these may be reported.
const store = {
  createSession(id: string) {
    return { id };
  },
  getSession(id: string) {
    return { id };
  },
  listSessions() {
    return [] as Array<{ id: string }>;
  },
};

export async function warm(id: string) {
  store.createSession(id);
  store.getSession(id);
  store.listSessions();
  return bb.sessions.retrieve(id);
}
