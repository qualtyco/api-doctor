import { auth } from './lib/firebase';

export async function impersonate(user: Parameters<typeof auth.updateCurrentUser>[0]) {
  await auth['updateCurrentUser'](user);
}
