// The token literal hides one hop away in a "config" constant.
import { S2, S2Environment } from '@s2-dev/streamstore';

const S2_TOKEN = `s2-staging-b81f3d55aa0c47e2910f6d3c8a24be71`;

export const s2 = new S2({
  ...S2Environment.parse(),
  accessToken: S2_TOKEN,
});

export function feedStream(tenant: string) {
  return s2.basin('feeds').stream(`tenants/${tenant}/events`);
}
