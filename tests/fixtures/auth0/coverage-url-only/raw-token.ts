export async function getManagementToken() {
  const res = await fetch('https://your-tenant.auth0.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: process.env.AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET,
      audience: 'https://your-tenant.auth0.com/api/v2/',
    }),
  });
  return res.json();
}
