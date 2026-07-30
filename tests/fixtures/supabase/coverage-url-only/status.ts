export async function checkAuthHealth() {
  const res = await fetch('https://xyzcompany.supabase.co/auth/v1/health', {
    headers: { apikey: process.env.SUPABASE_ANON_KEY ?? '' },
  });
  return res.ok;
}
