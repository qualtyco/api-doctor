// No SDK import anywhere in this fixture: detection is URL-pattern only, so
// coverage must be omitted entirely (not emitted empty).
export async function checkTail(stream: string) {
  const res = await fetch(`https://aws.s2.dev/v1/streams/${encodeURIComponent(stream)}/records/tail`, {
    headers: { Authorization: `Bearer ${process.env.S2_ACCESS_TOKEN}` },
  });
  return res.json();
}
