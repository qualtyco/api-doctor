import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Different table/column and positive-form typeof check (vs. the negative
// guard-and-return form in the other fixture), and `account_id` is passed
// under a renamed property rather than shorthand.
export async function linkAccount(rawAccountId: unknown) {
  const isValid = typeof rawAccountId === 'string';
  if (!isValid) throw new Error('account_id must be a string');

  return supabase
    .from('accounts')
    .upsert({ account_id: rawAccountId, linked_at: new Date().toISOString() });
}
