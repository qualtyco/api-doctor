export async function getStatus(id: string) {
  const res = await fetch(`https://api.resend.com/emails/${id}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  });
  return res.json();
}
