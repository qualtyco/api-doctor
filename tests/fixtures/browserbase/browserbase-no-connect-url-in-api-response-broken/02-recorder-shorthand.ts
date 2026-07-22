import { NextResponse } from 'next/server';
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function POST() {
  const session = await bb.sessions.create({ projectId: process.env.BROWSERBASE_PROJECT_ID });
  const { connectUrl } = session;

  return NextResponse.json({ sessionId: session.id, connectUrl });
}
