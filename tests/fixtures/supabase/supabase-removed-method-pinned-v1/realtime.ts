import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export function teardown(subscription: unknown) {
  supabase.removeSubscription(subscription as never);
  return supabase.getSubscriptions();
}
