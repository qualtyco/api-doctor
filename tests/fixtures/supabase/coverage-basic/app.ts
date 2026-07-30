import { supabase } from '@/lib/supabase';

// Fluent chains: only the client-rooted hop (from / storage.from / channel) is
// attributable — select/eq/order, upload, and on/subscribe are builder-stage.
export async function listMessages(userId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, body, created_at')
    .eq('receiver_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function archiveOldMessages() {
  const { error } = await supabase.rpc('archive_old_messages', { days: 30 });
  if (error) throw error;
}

export async function summarize(text: string) {
  const { data, error } = await supabase.functions.invoke('summarize', { body: { text } });
  if (error) throw error;
  return data;
}

export async function uploadAvatar(userId: string, file: Blob) {
  const { error } = await supabase.storage.from('avatars').upload(`public/${userId}.png`, file);
  if (error) throw error;
}

export function subscribeToMessages(userId: string, onMessage: (payload: unknown) => void) {
  return supabase
    .channel(`messages:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
      onMessage,
    )
    .subscribe();
}
