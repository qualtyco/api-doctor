// Renamed constructor import plus a renamed client variable — both must
// still verify and attribute metrics.account.
import { S2 as StreamStore } from '@s2-dev/streamstore';

const store = new StreamStore({ accessToken: process.env.S2_ACCESS_TOKEN ?? '' });

export async function accountOps() {
  return store.metrics.account({
    set: 'account-ops',
    start: new Date(Date.now() - 3_600_000),
    end: new Date(),
    interval: 'minute',
  });
}
