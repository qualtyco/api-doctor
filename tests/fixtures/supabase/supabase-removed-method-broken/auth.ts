// v1 auth idioms on an installed v2. None of these methods exists on the
// v2 client — each is a TypeError at runtime, not a build error.
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function login(email: string, password: string) {
  const { user, error } = await supabase.auth.signIn({ email, password });
  if (error) throw error;
  return user;
}

export function currentUser() {
  return supabase.auth.user();
}

export function currentSession() {
  return supabase.auth.session();
}

export async function changeEmail(email: string) {
  return supabase.auth.update({ email });
}
