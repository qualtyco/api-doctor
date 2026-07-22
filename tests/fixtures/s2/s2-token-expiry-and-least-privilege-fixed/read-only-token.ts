// Account-wide but read-only AND expiring — S2's own docs issue exactly
// this shape for read-side consumers.
import { S2, S2Environment } from '@s2-dev/streamstore';

const admin = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function issueReadOnlyToken() {
  const readOnly = await admin.accessTokens.issue({
    id: `read-only-${Date.now()}`,
    scope: {
      opGroups: { stream: { read: true } },
    },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  return readOnly.accessToken;
}
