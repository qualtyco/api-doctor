// Issues a token with read+write over every basin and stream and no expiry —
// a standing account-wide credential.
import { S2, S2Environment } from '@s2-dev/streamstore';

const admin = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function issueServiceToken(serviceName: string) {
  const { accessToken } = await admin.accessTokens.issue({
    id: `service-${serviceName}`,
    scope: {
      opGroups: { stream: { read: true, write: true } },
    },
  });
  return accessToken;
}
