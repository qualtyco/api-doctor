import { update, ref } from 'firebase/database';

export async function syncProfileFromApi(realtimeDb: any, userId: string, apiUrl: string) {
  const response = await fetch(apiUrl);
  const profile = await response.json();

  // profile is forwarded straight into update() with no field validation.
  await update(ref(realtimeDb, `users/${userId}/profile`), profile);
}
