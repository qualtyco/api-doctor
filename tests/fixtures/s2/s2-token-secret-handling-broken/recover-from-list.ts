// Tries to "recover" a lost secret from list() — but list() returns
// metadata only; the secret exists solely in the issue() response.
import { S2, S2Environment } from '@s2-dev/streamstore';

const admin = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function findTokenSecret(tokenId: string) {
  const listed = await admin.accessTokens.list({ prefix: 'viewer-' });

  for (const token of listed.accessTokens) {
    if (token.id === tokenId) {
      return token.accessToken; // undefined: secrets are never listed
    }
  }
  return null;
}
