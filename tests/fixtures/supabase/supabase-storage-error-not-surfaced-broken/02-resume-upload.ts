import { supabase } from '../client.js';

export async function saveResume(userId: string, file: File, resumeUrl: string) {
  const { error: uploadError } = await supabase.storage.from('resumes').upload(`${userId}/resume.pdf`, file);
  if (!uploadError) {
    const { data } = supabase.storage.from('resumes').getPublicUrl(`${userId}/resume.pdf`);
    resumeUrl = data.publicUrl;
  }
  return supabase.from('profiles').update({ resume_url: resumeUrl }).eq('user_id', userId);
}
