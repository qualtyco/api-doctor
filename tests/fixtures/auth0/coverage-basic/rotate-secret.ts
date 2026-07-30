// Imports the wrapper through a tsconfig-style alias — the collector must
// resolve `@/lib/auth0` to the scanned wrapper module by path suffix.
import { management } from '@/lib/auth0';

export async function rotateClientSecret(clientId: string) {
  const { data } = await management.clients.rotateSecret(clientId);
  return data;
}
