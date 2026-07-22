import { supabase } from '../client.js';

export async function handleSave(projectId: string, userId: string) {
  await supabase.from('saved_projects').insert({ project_id: projectId, user_id: userId });
}
