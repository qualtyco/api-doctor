// Writes the issued secret into server logs — a live bearer credential in
// log storage, readable by anyone with log access.
import { S2, S2Environment } from '@s2-dev/streamstore';

const admin = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function provisionViewer(sessionId: string) {
  const issued = await admin.accessTokens.issue({
    id: `viewer-${sessionId}`,
    scope: {
      basins: { exact: 'chat-app' },
      streams: { prefix: `chat/${sessionId}/` },
      opGroups: { stream: { read: true } },
    },
    expiresAt: new Date(Date.now() + 3600 * 1000),
  });

  console.log('issued viewer token %s: %s', sessionId, issued.accessToken);
  return issued.accessToken;
}
