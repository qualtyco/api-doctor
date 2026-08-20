import { createClient } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function teardown(channel: RealtimeChannel) {
  await supabase.removeChannel(channel);
  return supabase.getChannels();
}

export async function teardownAll() {
  await supabase.removeAllChannels();
}
