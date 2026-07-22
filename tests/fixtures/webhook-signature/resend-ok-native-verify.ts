import { NextResponse } from 'next/server';
import { resend } from '@/lib/resend';

// From Resend's own docs (https://resend.com/docs/receive-emails):
// verification happens via resend.webhooks.verify(), not a `svix` import.
export async function POST(request: Request) {
  const payload = await request.text();

  const event = resend.webhooks.verify({
    payload,
    headers: {
      'svix-id': request.headers.get('svix-id'),
      'svix-timestamp': request.headers.get('svix-timestamp'),
      'svix-signature': request.headers.get('svix-signature'),
    },
    secret: process.env.RESEND_WEBHOOK_SECRET,
  });

  return NextResponse.json({ received: true, type: event.type });
}
