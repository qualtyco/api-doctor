// Scaffolded quickstart where the placeholder was replaced with a real
// token and committed.
import { AppendInput, AppendRecord, S2 } from '@s2-dev/streamstore';

const s2 = new S2({
  accessToken: 's2-prod-4f8a2c91e7b3d605a1f9c8e2b4d7a3f6',
});

export async function logSignup(email: string) {
  const stream = s2.basin('analytics').stream('signups');
  await stream.append(
    AppendInput.create([AppendRecord.string({ body: email })]),
  );
}
