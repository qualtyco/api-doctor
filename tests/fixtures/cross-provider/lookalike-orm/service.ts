// Cross-fire contract: the genuine supabase mutation below must keep its
// finding, and the identically-shaped call on the imported look-alike must
// not be attributed to supabase.
import { createClient } from '@supabase/supabase-js';
import { orm } from './orm.js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

export async function recordSignup(email: string) {
  await supabase.from('signups').insert({ email });
  await orm.from('signups_audit').insert({ email });
}
