import { supabase } from '../client.js';

interface EducationRow {
  school: string;
  start_year: number;
}

export async function replaceEducation(userId: string, rows: EducationRow[]) {
  await supabase.from('education').delete().eq('user_id', userId);
  for (const row of rows) {
    await supabase.from('education').insert({ user_id: userId, ...row });
  }
}
