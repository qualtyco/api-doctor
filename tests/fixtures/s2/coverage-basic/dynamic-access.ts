import { s2 } from '@/lib/s2';

// String-literal computed access is still a closed-vocabulary path.
export async function listLocations() {
  return s2['locations']['list']();
}
