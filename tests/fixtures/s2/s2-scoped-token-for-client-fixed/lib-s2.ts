// lib/s2.ts — server-only client module. The admin token stays in server
// code and is never serialized into a response or client bundle.
import { S2, S2Environment } from '@s2-dev/streamstore';

const accessToken = process.env.S2_ACCESS_TOKEN;
if (!accessToken) throw new Error('Set S2_ACCESS_TOKEN');

export const s2 = new S2({ ...S2Environment.parse(), accessToken });

export function chatStream(sessionId: string) {
  return s2.basin('chat-app').stream(`chat/${sessionId}/events`);
}
