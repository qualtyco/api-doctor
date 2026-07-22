import { supabase } from '../client.js';

export function subscribeInbox(userId: string, fetchMessages: () => void) {
  return supabase
    .channel('messages-inbox')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
      () => fetchMessages(),
    )
    .subscribe();
}
