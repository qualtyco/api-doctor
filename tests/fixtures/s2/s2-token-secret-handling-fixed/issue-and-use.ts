// Adversarial: the destructured secret is *used* — building a scoped client
// and handing the token to its consumer — which looks like mishandling but
// is exactly the documented issue-once handoff. Nothing reaches a log sink.
import { S2, S2Environment } from '@s2-dev/streamstore';

const admin = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function POST(request: Request) {
  const { sessionId } = await request.json();

  const { accessToken } = await admin.accessTokens.issue({
    id: `viewer-${sessionId}`,
    scope: {
      basins: { exact: 'chat-app' },
      streams: { prefix: `chat/${sessionId}/` },
      opGroups: { stream: { read: true } },
    },
    expiresAt: new Date(Date.now() + 3600 * 1000),
  });

  const viewer = new S2({ accessToken });
  await viewer.basin('chat-app').stream(`chat/${sessionId}/events`).checkTail();

  return Response.json({ token: accessToken });
}
