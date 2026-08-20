// Identical code to the broken fixture, on a project deliberately pinned to
// v1. Every call here is correct against what is installed, so the rule stays
// silent forever — it never suggests upgrading.
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
