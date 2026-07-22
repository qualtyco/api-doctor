import { Resend } from 'resend';
import { Webhook } from 'svix';

export async function POST(req: Request) {
  // verify happens before accessing the body: should be allowed
  Webhook.verify('payload', {});
  const body = await req.json();
  void Resend;
  return new Response(JSON.stringify(body), { status: 200 });
}

