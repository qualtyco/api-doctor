import { createClient as makeSupabase } from '@supabase/supabase-js';

const serviceUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE;
if (!serviceUrl || !serviceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set');
}

const admin = makeSupabase(serviceUrl, serviceKey);

export async function provisionUser(email: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  return data.user;
}
