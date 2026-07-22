import { supabase } from '../client.js';

interface ExperienceRow {
  company: string;
  title: string;
}

export async function replaceExperiences(userId: string, rows: ExperienceRow[]) {
  await supabase.from('experiences').delete().eq('user_id', userId);
  for (const row of rows) {
    await supabase.from('experiences').insert({ user_id: userId, ...row });
  }
}
