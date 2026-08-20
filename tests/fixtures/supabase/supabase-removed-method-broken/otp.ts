import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function confirm(phone: string, token: string) {
  // Capitalisation changed in v2: verifyOTP → verifyOtp.
  return supabase.auth.verifyOTP({ phone, token, type: 'sms' });
}

export function bearer(accessToken: string) {
  // No successor at all — setAuth faked a session from a bare access token.
  return supabase.auth.setAuth(accessToken);
}
