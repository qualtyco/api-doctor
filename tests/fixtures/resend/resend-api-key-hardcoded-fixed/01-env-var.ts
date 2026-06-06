import { Resend } from 'resend';
import { NextResponse } from 'next/server';

// Key is read from the environment, never embedded in source.
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { email } = await req.json();

  const { data, error } = await resend.emails.send({
    from: 'Acme <onboarding@acme.com>',
    to: [email],
    subject: 'Welcome',
    html: '<p>Welcome aboard</p>',
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data?.id });
}
