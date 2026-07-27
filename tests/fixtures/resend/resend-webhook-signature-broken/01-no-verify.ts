import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const payload = await req.json();
  console.log(payload.type);
  return new Response('ok');
}
