import { supabase } from '../client.js';

export async function loadOptionalProject(id: string) {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}
