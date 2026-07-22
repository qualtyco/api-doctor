// app/api/s2-token/route.ts — adversarial: returns a token to the browser,
// but it is a short-lived scoped token issued on the server (the documented
// pattern), not the account-wide admin credential.
import { NextResponse } from 'next/server';
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
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  return NextResponse.json({ token: accessToken });
}
