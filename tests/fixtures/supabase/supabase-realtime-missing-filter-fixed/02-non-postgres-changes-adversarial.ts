import { supabase } from '../client.js';

export function subscribePresence(userId: string, onStatus: (payload: unknown) => void) {
  return supabase
    .channel('presence')
    .on('presence', { event: 'sync' }, () => onStatus(null))
    .subscribe();
}
