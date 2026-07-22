// app/api/s2-token/route.ts — hands the account-wide admin token to the
// browser so the frontend can "read the stream directly".
import { NextResponse } from 'next/server';
import { S2 } from '@s2-dev/streamstore';

const adminToken = process.env.S2_ACCESS_TOKEN!;
const s2 = new S2({ accessToken: adminToken });

export async function GET() {
  const basin = s2.basin('chat-app');
  const { tail } = await basin.stream('lobby').checkTail();

  return NextResponse.json({
    token: adminToken,
    tailSeqNum: tail.seqNum,
  });
}
