import { supabase } from '../integrations/supabase/client';

// Distinct manifestation: a trial-expiry column on a different table, and
// the only other comparison in this file is against an unrelated boolean
// column (is_trial), never against trial_expires_at itself.
export function StartTrialButton({ userId }: { userId: string }) {
  async function startTrial() {
    const trialExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('profiles').update({ is_trial: true, trial_expires_at: trialExpiresAt }).eq('user_id', userId);
  }

  function isTrialUser(profile: { is_trial: boolean }) {
    return profile.is_trial === true;
  }

  return null;
}
