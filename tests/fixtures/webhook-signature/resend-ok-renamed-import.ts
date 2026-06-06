import { Resend } from 'resend';
import { Webhook as MyHook } from 'svix';

export async function POST(req: Request) {
  // renamed import: verify uses MyHook.verify(...)
  MyHook.verify('payload', {});
  const body = await req.json();
  void Resend;
  return new Response(JSON.stringify(body), { status: 200 });
}

