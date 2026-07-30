import { supabase } from './lib/supabase';

// A bare reference is not a call — auth.signOut must not be recorded.
export const signOutHandler = supabase.auth.signOut;

// Destructured resources are a documented punt — auth.getSession must not be recorded.
const { auth } = supabase;

export async function currentSession() {
  const { data } = await auth.getSession();
  return data.session;
}

// A wrong-root object with a colliding fluent shape must not be recorded.
const legacyDb = {
  from: (_table: string) => ({ select: async () => [] as unknown[] }),
};

export async function listLegacyUsers() {
  return legacyDb.from('users').select();
}

// A config-chain helper outside the documented surface: verified client, but
// storage.setHeader is builder-stage config — counts as an unknown SDK call.
export function tagStorageRequests(appName: string) {
  supabase.storage.setHeader('x-application-name', appName);
}
