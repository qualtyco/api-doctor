import { supabase } from '../integrations/supabase/client';

// Distinct manifestation: a different table/column and a different price
// label ("$9/mo" instead of "$3"), same missing-payment-call shape.
export function UpgradeBanner({ userId }: { userId: string }) {
  async function upgradeToPremium() {
    await supabase.from('profiles').update({ is_premium: true }).eq('user_id', userId);
  }

  return <button onClick={upgradeToPremium}>Upgrade to Premium — $9/mo</button>;
}
