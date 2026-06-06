import { Webhook } from 'svix';

const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET ?? '');

type ResendEvent = { type: string; created_at: string };

// Branches on event type but never tracks which events were already handled.
export async function POST(req: Request) {
  const body = await req.text();
  const event = wh.verify(body, Object.fromEntries(req.headers as any)) as ResendEvent;

  switch (event.type) {
    case 'email.bounced':
      await handleBounce();
      break;
    default:
      break;
  }

  return new Response('ok', { status: 200 });
}

async function handleBounce() {}
