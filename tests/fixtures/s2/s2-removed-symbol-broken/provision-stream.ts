// Namespace-import variant: the removed symbol is called as a member of the
// SDK namespace. Installed 0.25.0 has ensureStream instead.
import * as s2sdk from '@s2-dev/streamstore';

export async function provisionStream(stream: string) {
  await s2sdk.createOrReconfigureStream({
    path: { stream },
    body: {},
  });
}
