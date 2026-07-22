// Reads the token from the environment but hard-pins the endpoints to the
// cloud service — S2_ACCOUNT_ENDPOINT/S2_BASIN_ENDPOINT are ignored, so
// s2-lite / self-hosted deployments can't be targeted.
import { S2 } from '@s2-dev/streamstore';

export const s2 = new S2({
  accessToken: process.env.S2_ACCESS_TOKEN!,
});

export function auditStream(tenant: string) {
  return s2.basin('audit').stream(`tenants/${tenant}/log`);
}
