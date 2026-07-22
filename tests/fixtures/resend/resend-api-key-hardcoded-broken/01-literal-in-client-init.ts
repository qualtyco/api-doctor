import { Resend } from 'resend';
import { NextResponse } from 'next/server';

// Hardcoded secret key passed straight into the client constructor.
const resend = new Resend('re_123456789_AbCdEfGhIjKlMnOp');

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
