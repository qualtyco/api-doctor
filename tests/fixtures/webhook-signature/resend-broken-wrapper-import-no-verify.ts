import { resend } from '@/lib/resend';

// No verification at all — should be reported. This uses the same wrapper
// import pattern as Resend's own docs example, to prove the rule's
// Resend-file detection isn't limited to a literal `from 'resend'` import.
export async function POST(req: Request) {
  const body = await req.json();
  void resend;
  return new Response(JSON.stringify(body), { status: 200 });
}
