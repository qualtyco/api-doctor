// Adversarial: no S2Environment.parse() spread — looks pinned — but the
// endpoints are wired explicitly from env with an undefined fallback
// (the resumable-chat server pattern for s2-lite/local development).
import { S2 } from '@s2-dev/streamstore';

export const s2 = new S2({
  accessToken: process.env.S2_ACCESS_TOKEN!,
  endpoints: {
    account: process.env.S2_ACCOUNT_ENDPOINT ?? undefined,
    basin: process.env.S2_BASIN_ENDPOINT ?? undefined,
  },
});
