import { push, ref, set } from 'firebase/database';

export async function addFatigueEntries(realtimeDb: any, userId: string, entries: any[]) {
  await Promise.all(
    entries.map((entry) => {
      const newEntryRef = push(ref(realtimeDb, `users/${userId}/fatigue`));
      return set(newEntryRef, entry);
    }),
  );
}
