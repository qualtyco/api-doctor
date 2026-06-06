import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const body = await req.json();

  // Adversarial: a 500 inside an `if`, but the condition is NOT a Resend error
  // (it is input validation), so it must not be flagged.
  if (!body.email) {
    return NextResponse.json({ error: 'email is required' }, { status: 500 });
  }

  const { data, error } = await resend.emails.send({
    from: 'Acme <onboarding@acme.com>',
    to: [body.email],
    subject: 'Welcome',
    html: '<p>Welcome</p>',
    idempotencyKey: `welcome/${body.email}`,
  });

  if (error) {
    const status = error.name === 'validation_error' ? 422 : 502;
    return NextResponse.json({ message: error.message }, { status });
  }

  return NextResponse.json({ id: data?.id });
}
