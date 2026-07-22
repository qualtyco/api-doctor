// The official pattern: swallow the 409 (already exists) and rethrow
// everything else.
import { S2, S2Environment, S2Error } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function ensureStreams() {
  const basin = s2.basin('chat-app');

  await basin.streams.create({ stream: 'lobby' }).catch((error: unknown) => {
    if (!(error instanceof S2Error && error.status === 409)) {
      throw error;
    }
  });
}
