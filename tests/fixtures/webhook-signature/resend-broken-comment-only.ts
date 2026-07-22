import { Resend } from 'resend';

export async function POST(req: Request) {
  // webhook.verify(payload, headers)
  const body = await req.json();
  void Resend;
  return new Response(JSON.stringify(body), { status: 200 });
}

