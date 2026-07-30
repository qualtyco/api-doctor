import { ManagementClient as Auth0Mgmt } from 'auth0';

const m = new Auth0Mgmt({
  domain: 'your-tenant.auth0.com',
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
});

export async function loadUser(id: string) {
  const { data } = await m.users.get(id);
  return data;
}

export async function rawStats() {
  // Passthrough transport escape hatch — deliberately outside the surface, so
  // this call must be counted as an unknown SDK call, never as `used`.
  const res = await m.fetch('https://your-tenant.auth0.com/api/v2/stats/active-users');
  return res.json();
}
