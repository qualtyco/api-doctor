import StreamSocket, { StartBaseAudioMessage } from '@/services/StreamSocket';

// Looks suspicious because there's a `.set()` call alongside callSid usage,
// and the key looks like a "from" field, but it's accessed via computed
// bracket notation on an unrelated request object, not the caller-from
// identifier this rule is built to catch — a per-number throttle map is a
// legitimate, intentional use of phone-number keys.
export function registerThrottle(ss: StreamSocket, rateLimiter: Map<string, number>, req: { body: Record<string, unknown> }) {
  const callSid = ss.streamSid;
  rateLimiter.set(req.body['from'] as string, (rateLimiter.get(req.body['from'] as string) ?? 0) + 1);
  console.log('Tracked callSid', callSid);
}
