import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

// Sends the request-provided array straight to batch.send with no size guard.
export async function POST(req: Request) {
  const { emails } = await req.json();

  const { data, error } = await resend.batch.send(emails);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ids: data?.data?.map((r) => r.id) });
}
