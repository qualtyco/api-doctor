export async function readMessages(): Promise<unknown> {
  const res = await fetch('https://demo-app-default-rtdb.firebaseio.com/messages.json', {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`RTDB read failed with status ${res.status}`);
  }
  return res.json();
}
