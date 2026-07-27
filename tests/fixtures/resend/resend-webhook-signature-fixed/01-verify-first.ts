import { Resend } from 'resend';
import type { NextRequest } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  const payload = await req.text();
  resend.webhooks.verify({
    payload,
    headers: {
      id: req.headers.get('svix-id')!,
      timestamp: req.headers.get('svix-timestamp')!,
      signature: req.headers.get('svix-signature')!,
    },
    webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
  });
  return new Response('ok');
}
