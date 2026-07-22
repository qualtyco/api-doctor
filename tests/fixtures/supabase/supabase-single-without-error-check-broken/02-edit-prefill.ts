import { supabase } from '../client.js';

export async function loadProjectForEdit(id: string) {
  const { data } = await supabase.from('projects').select('title, body').eq('id', id).single();
  return data;
}
