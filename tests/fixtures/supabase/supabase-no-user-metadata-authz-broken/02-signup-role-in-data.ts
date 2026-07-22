import { supabase } from '../client.js';

export async function signUp(email: string, password: string, role: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { role, full_name: 'Demo' } },
  });
}
