// Adversarial: this module never calls close() — which looks like a leak —
// but the handles it creates are handed to the caller (returned, or owned
// by a Producer), and the owner closes them.
import { BatchTransform, Producer, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function openEventsSession() {
  const stream = s2.basin('analytics').stream('events');
  const session = await stream.appendSession();
  return session;
}

export async function buildProducer() {
  const stream = s2.basin('analytics').stream('events');
  const session = await stream.appendSession();
  return new Producer(new BatchTransform({ lingerDurationMillis: 5 }), session);
}
