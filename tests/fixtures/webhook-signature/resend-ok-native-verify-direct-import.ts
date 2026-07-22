import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// resend.webhooks.verify() is Resend's own documented verification method
// (https://resend.com/docs/receive-emails) — not a `svix` import, but still
// valid, and it runs before the body is read.
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

  return new Response(JSON.stringify({ received: true, type: event.type }));
}
