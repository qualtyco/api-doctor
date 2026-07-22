import { onValue, ref } from 'firebase/database';

export function subscribeToFatigueEntries(realtimeDb: any, userId: string, setEntries: (v: any[]) => void) {
  const entriesRef = ref(realtimeDb, `users/${userId}/fatigue`);
  return onValue(entriesRef, (snapshot) => {
    setEntries(Object.values(snapshot.val() ?? {}));
  });
}
