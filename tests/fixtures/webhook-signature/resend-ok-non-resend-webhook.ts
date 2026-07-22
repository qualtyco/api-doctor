import Stripe from 'stripe';

export async function POST(req: Request) {
  const body = await req.json();
  void Stripe;
  return new Response(JSON.stringify(body), { status: 200 });
}

