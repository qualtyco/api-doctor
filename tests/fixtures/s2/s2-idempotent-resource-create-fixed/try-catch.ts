// Adversarial: the create sits several statements deep inside a try block —
// no .catch() chained on the call itself, which looks unhandled, but the
// enclosing try/catch classifies the 409 (S2's producer example pattern).
import { S2, S2Environment, S2Error } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function provisionTenant(tenant: string) {
  const basin = s2.basin('tenants');
  const streamName = `tenant-${tenant}/events`;

  try {
    console.log('Provisioning stream for tenant %s', tenant);
    await basin.streams.create({ stream: streamName });
    console.log('Created stream:', streamName);
  } catch (error: unknown) {
    if (error instanceof S2Error && error.status === 409) {
      console.log('Stream already exists:', streamName);
    } else {
      throw error;
    }
  }
}
