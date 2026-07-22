import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

// Marketing campaign route sending promotional content via batch.send.
export async function POST(req: Request) {
  const { recipients } = await req.json();

  const active = recipients.filter((r: any) => !r.unsubscribed);

  const { data, error } = await resend.batch.send(
    active.map((r: any) => ({
      from: 'Acme <news@acme.com>',
      to: [r.email],
      subject: 'Big Summer Sale',
      html: '<h1>50% off everything</h1>',
    })),
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ids: data?.data?.map((r) => r.id) });
}
