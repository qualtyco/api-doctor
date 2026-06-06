import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

// Guards the batch size before sending.
export async function POST(req: Request) {
  const { emails } = await req.json();

  if (emails.length > 100) {
    return NextResponse.json({ error: 'Too many recipients' }, { status: 400 });
  }

  const { data, error } = await resend.batch.send(emails);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ids: data?.data?.map((r) => r.id) });
}
