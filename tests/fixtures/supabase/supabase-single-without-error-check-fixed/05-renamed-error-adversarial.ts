import { supabase } from '../client.js';

// Adversarial: two queries in one scope force the error binding to be renamed.
// `error: modelError` still destructures `error` — matching on the local name
// would flag correctly written code.
export async function resolveModel(configId: string) {
  const { data: configData, error: configError } = await supabase
    .from('user_ai_configs')
    .select('selected_model_id')
    .eq('id', configId)
    .single();
  if (configError || !configData) return null;

  const { data: modelData, error: modelError } = await supabase
    .from('ai_models')
    .select('model_identifier')
    .eq('id', configData.selected_model_id)
    .single();
  if (modelError) return null;

  return modelData?.model_identifier ?? null;
}

// Also fine: renamed error destructured from the result object afterwards.
export async function loadProject(id: string) {
  const result = await supabase.from('projects').select('*').eq('id', id).single();
  const { error: projectError } = result;
  if (projectError) throw projectError;
  return result.data;
}
