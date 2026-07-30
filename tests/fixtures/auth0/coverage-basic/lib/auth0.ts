import { ManagementClient } from 'auth0';

export const management = new ManagementClient({
  domain: 'your-tenant.auth0.com',
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
});
