import { Webhook } from 'svix';

const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET ?? '');
const processed = new Set<string>();

// In-memory dedup keyed on the event's email_id.
export async function POST(req: Request) {
  const payload = await req.text();
  const event = wh.verify(payload, Object.fromEntries(req.headers as any)) as {
    type: string;
    data: { email_id: string };
  };

  if (processed.has(event.data.email_id)) {
    return new Response('duplicate', { status: 200 });
  }
  processed.add(event.data.email_id);

  return new Response('ok', { status: 200 });
}
