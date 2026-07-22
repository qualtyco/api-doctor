import { supabase } from '../client.js';

export async function listMessages(userId: string) {
  const { data } = await supabase.from('messages').select('*').eq('receiver_id', userId);
  return data ?? [];
}
