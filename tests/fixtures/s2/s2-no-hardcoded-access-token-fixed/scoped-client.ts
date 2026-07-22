// Adversarial: a token-looking string appears in a comment (never an AST
// node, e.g. accessToken: "s2-prod-4f8a2c91e7b3d605a1f9c8e2b4d7a3f6" is what
// NOT to do), and the client below receives a token from an issue() call
// result — a member expression, not a literal.
import { S2, S2Environment } from '@s2-dev/streamstore';

const admin = new S2({
  ...S2Environment.parse(),
  accessToken: process.env.S2_ACCESS_TOKEN!,
});

export async function tenantClient(tenant: string) {
  const issued = await admin.accessTokens.issue({
    id: `tenant-${tenant}-${Date.now()}`,
    scope: {
      basins: { exact: 'feeds' },
      streams: { prefix: `tenants/${tenant}/` },
      opGroups: { stream: { read: true, write: true } },
    },
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });

  return new S2({ accessToken: issued.accessToken });
}
