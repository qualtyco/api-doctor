import { supabase } from '../client.js';

export function subscribeThread(fetchMessages: () => void) {
  return supabase
    .channel('messages-thread')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => fetchMessages())
    .subscribe();
}
