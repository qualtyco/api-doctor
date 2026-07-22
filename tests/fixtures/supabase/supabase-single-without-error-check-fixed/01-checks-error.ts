import { supabase } from '../client.js';

export async function loadProject(id: string) {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data;
}
