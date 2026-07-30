import { supabase } from './lib/supabase';

// Computed access with string literals resolves like dotted access.
export async function listBuckets() {
  const { data, error } = await supabase['storage']['listBuckets']();
  if (error) throw error;
  return data;
}
