// Same code as the broken fixture, but this project deliberately pins 0.23.0,
// where createOrReconfigureBasin exists. Correct for the installed version —
// the rule must stay silent forever, never suggest upgrading.
import { createOrReconfigureBasin } from '@s2-dev/streamstore';

export async function provisionBasin(name: string) {
  await createOrReconfigureBasin({
    path: { basin: name },
    body: { default_stream_config: { storage_class: 'standard' } },
  });
}
