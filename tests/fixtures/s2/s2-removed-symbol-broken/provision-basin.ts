// Agent-written provisioning code using the pre-0.24.0 generated-SDK name.
// This project has 0.25.0 installed, where the symbol no longer exists.
import { createOrReconfigureBasin } from '@s2-dev/streamstore';

export async function provisionBasin(name: string) {
  await createOrReconfigureBasin({
    path: { basin: name },
    body: { default_stream_config: { storage_class: 'standard' } },
  });
}
