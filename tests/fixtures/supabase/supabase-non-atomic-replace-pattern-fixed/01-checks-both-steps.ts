import { supabase } from '../client.js';

interface EducationRow {
  school: string;
  start_year: number;
}

export async function replaceEducation(userId: string, rows: EducationRow[]) {
  const { error: deleteError } = await supabase.from('education').delete().eq('user_id', userId);
  if (deleteError) throw deleteError;
  for (const row of rows) {
    const { error } = await supabase.from('education').insert({ user_id: userId, ...row });
    if (error) throw error;
  }
}
