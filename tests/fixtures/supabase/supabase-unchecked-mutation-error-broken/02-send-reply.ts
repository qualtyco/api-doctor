import { supabase } from '../client.js';

export async function sendReply(senderId: string, receiverId: string, body: string) {
  const { data } = await supabase.from('messages').insert({ sender_id: senderId, receiver_id: receiverId, body });
  return data;
}
