// Test files are excluded from coverage — channel and removeAllChannels must
// not be recorded from here.
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://xyzcompany.supabase.co', 'test-anon-key');

it('subscribes to a room channel', async () => {
  const channel = supabase.channel('room:test').subscribe();
  await supabase.removeAllChannels();
  void channel;
});

declare function it(name: string, fn: () => Promise<void>): void;
