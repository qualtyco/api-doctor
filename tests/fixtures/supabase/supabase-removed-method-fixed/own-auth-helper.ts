import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

// A project's own auth facade with v1-shaped method names, in a file that
// also holds a real Supabase client. The receiver is `auth`, not the client,
// so none of these may be reported — file-level Supabase evidence must not be
// enough to claim a specific call throws.
const auth = {
  signIn(_creds: { email: string; password: string }) {
    return { user: null };
  },
  user() {
    return null;
  },
  session() {
    return null;
  },
};

export async function login(email: string, password: string) {
  const local = auth.signIn({ email, password });
  const cached = auth.user();
  const stale = auth.session();
  const { data } = await supabase.auth.getUser();
  return { local, cached, stale, real: data.user };
}
