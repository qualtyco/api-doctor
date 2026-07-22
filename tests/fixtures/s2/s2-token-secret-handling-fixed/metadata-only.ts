// Official pattern: list() consumed as metadata (id-based revocation,
// logging the id and the metadata object — never a secret).
import { S2, S2Environment } from '@s2-dev/streamstore';

const admin = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function revokeExpiredDemoTokens() {
  const listed = await admin.accessTokens.list({ prefix: 'demo-' });

  for (const token of listed.accessTokens) {
    console.log('Revoking token: %s', token.id);
    console.dir(token, { depth: null });
    await admin.accessTokens.revoke({ id: token.id });
  }
}
