// Adversarial: `basins: { prefix: "" }` matches ALL basins, which looks like
// the over-broad-scope bug — but the documented multi-tenant pattern pairs it
// with a real streams prefix and limited opGroups, so the token can only
// touch this user's streams in whatever basin they live in.
import { S2, S2Environment } from '@s2-dev/streamstore';

const admin = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function issueTenantToken(userId: string) {
  const { accessToken } = await admin.accessTokens.issue({
    id: `user-${userId}-rw-token`,
    scope: {
      basins: { prefix: '' }, // all basins
      streams: { prefix: `users/${userId}/` },
      opGroups: { stream: { read: true, write: true } },
    },
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return accessToken;
}
