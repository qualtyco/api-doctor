export async function listMessages(userId: string) {
  const res = await fetch(
    `https://xyzcompany.supabase.co/rest/v1/messages?receiver_id=eq.${userId}&select=*`,
    {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY ?? '',
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      },
    },
  );
  return res.json();
}
