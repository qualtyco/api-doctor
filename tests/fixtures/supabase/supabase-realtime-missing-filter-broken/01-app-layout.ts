import { supabase } from '../client.js';

export function subscribeMessages(userId: string, fetchUnread: () => void) {
  return supabase
    .channel('messages-unread')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchUnread())
    .subscribe();
}
