import { supabase } from '../client.js';

/** Role comes from an RLS-protected table — not from JWT metadata. */
export async function loadRole(userId: string) {
  const { data } = await supabase.from('profiles').select('role').eq('user_id', userId).single();
  return data?.role ?? 'student';
}
