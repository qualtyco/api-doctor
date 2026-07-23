import { resend } from '@/lib/resend';

// An outbound send endpoint: it parses its own request body and calls the
// SDK. It is not a webhook handler — no webhook path, no svix usage, no
// Resend event types — so the signature rule must not fire here.
export async function POST(request: Request) {
  const { email, name } = await request.json();

  const { data, error } = await resend.emails.send({
    from: 'hello@example.com',
    to: email,
    subject: 'Welcome aboard!',
    html: `<p>Hi ${name}</p>`,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ id: data?.id }), { status: 200 });
}
