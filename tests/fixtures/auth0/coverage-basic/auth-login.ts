import { AuthenticationClient } from 'auth0';

const auth = new AuthenticationClient({
  domain: 'your-tenant.auth0.com',
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
});

export async function login(username: string, password: string) {
  const { data } = await auth.oauth.passwordGrant({
    username,
    password,
    audience: 'https://api.example.com',
  });
  return data;
}

export async function startPasswordless(email: string) {
  await auth.passwordless.sendEmail({ email, send: 'code' });
}
