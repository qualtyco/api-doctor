import { Webhook } from 'svix';
import { redis } from '../../../../lib/redis';

const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET ?? '');

// Adversarial: no in-memory Map/Set, but dedups via a Redis store, so the
// handler is idempotent and must not be flagged.
export async function POST(req: Request) {
  const payload = await req.text();
  const event = wh.verify(payload, Object.fromEntries(req.headers as any)) as {
    type: string;
    data: { email_id: string };
  };

  const alreadyHandled = await redis.exists(`resend:event:${event.data.email_id}`);
  if (alreadyHandled) {
    return new Response('duplicate', { status: 200 });
  }
  await redis.set(`resend:event:${event.data.email_id}`, '1');

  return new Response('ok', { status: 200 });
}
