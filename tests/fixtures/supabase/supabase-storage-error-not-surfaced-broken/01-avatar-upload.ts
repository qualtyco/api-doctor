import { supabase } from '../client.js';

export async function saveAvatar(userId: string, file: File, avatarUrl: string) {
  const path = `${userId}/avatar.png`;
  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file);
  if (!uploadError) {
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    avatarUrl = data.publicUrl;
  }
  await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('user_id', userId);
}
