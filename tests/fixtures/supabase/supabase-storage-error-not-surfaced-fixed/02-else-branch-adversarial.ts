import { supabase } from '../client.js';

export async function saveAvatar(userId: string, file: File) {
  const path = `${userId}/avatar.png`;
  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file);
  if (!uploadError) {
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('user_id', userId);
  } else {
    throw uploadError;
  }
}
