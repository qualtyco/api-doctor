export async function getProfile(accessToken: string) {
  const res = await fetch('https://your-tenant.auth0.com/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}
