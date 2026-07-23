import { Resend } from 'resend';

// A genuine unverified webhook receiver in a path with no "webhook" hint,
// branching on a constant instead of an inline event-type literal. The
// behavioural signal — reading `.type` off the parsed body — must be enough.
const EVENT_BOUNCED = 'bounced_event';

export async function POST(request: Request) {
  const event = await request.json();
  void Resend;

  if (event.type === EVENT_BOUNCED) {
    console.log('bounced', event.data?.to);
  }
  return new Response('ok', { status: 200 });
}
