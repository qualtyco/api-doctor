import { supabase } from '../client.js';

// The destructured error is renamed to something that doesn't pattern-match
// "uploadError" — detection must come from tracking the upload await binding,
// not from the variable's name.
export async function saveAvatar(userId: string, file: File, avatarUrl: string) {
  const path = `${userId}/avatar.png`;
  const { error: e } = await supabase.storage.from('avatars').upload(path, file);
  if (!e) {
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    avatarUrl = data.publicUrl;
  }
  const { error } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('user_id', userId);
  if (error) throw error;
}
