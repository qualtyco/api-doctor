import { supabase } from '../client.js';

export async function removeEducation(userId: string) {
  const { error } = await supabase.from('education').delete().eq('user_id', userId);
  if (error) throw error;
}
