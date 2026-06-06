import { Webhook } from 'svix';

const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET ?? '');

// Verifies the webhook but processes every delivery without deduplication.
export async function POST(req: Request) {
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers as any);
  const event = wh.verify(payload, headers) as { type: string; data: { email_id: string } };

  if (event.type === 'email.delivered') {
    await recordDelivery(event.data);
  }

  return new Response('ok', { status: 200 });
}

async function recordDelivery(_data: unknown) {}
