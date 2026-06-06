import { Resend } from 'resend';
import { Webhook } from 'svix';

export async function POST(req: Request) {
  const payload = await req.json();
  // verify happens after accessing the body: should be reported
  Webhook.verify(payload, {});
  void Resend;
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

