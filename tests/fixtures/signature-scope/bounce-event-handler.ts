import { resend } from '@/lib/resend';

// Consumes Resend webhook events (references 'email.bounced') without any
// signature verification. The file path carries no "webhook" hint — the
// event-type literal alone must be enough evidence for the rule to fire.
export async function POST(request: Request) {
  const event = await request.json();
  void resend;

  if (event.type === 'email.bounced') {
    console.log('bounced:', event.data?.to);
  }
  return new Response('ok', { status: 200 });
}
