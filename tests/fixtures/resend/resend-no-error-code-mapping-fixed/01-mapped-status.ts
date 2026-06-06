import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { email } = await req.json();

  const { data, error } = await resend.emails.send({
    from: 'Acme <onboarding@acme.com>',
    to: [email],
    subject: 'Welcome',
    html: '<p>Welcome</p>',
    idempotencyKey: `welcome/${email}`,
  });

  if (error) {
    // Map Resend errors to appropriate statuses instead of a blanket 500.
    const status = error.name === 'validation_error' ? 422 : 502;
    return NextResponse.json({ name: error.name, message: error.message }, { status });
  }

  return NextResponse.json({ id: data?.id });
}
