// Namespace-import variant on the pinned 0.23.0 — symbol exists, no finding.
import * as s2sdk from '@s2-dev/streamstore';

export async function provisionStream(stream: string) {
  await s2sdk.createOrReconfigureStream({
    path: { stream },
    body: {},
  });
}
