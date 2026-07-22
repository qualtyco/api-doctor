// Express variant of the same hang: the live-tail snippet pasted into a
// request handler without a stop or abort path.
import express from 'express';
import { S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });
const app = express();

app.get('/api/audit/:tenant', async (req, res) => {
  const stream = s2.basin('audit').stream(`tenants/${req.params.tenant}/log`);

  const session = await stream.readSession({
    start: { from: { seqNum: 0 }, clamp: true },
  });

  const entries: string[] = [];
  for await (const record of session) {
    entries.push(String(record.body));
  }

  res.json({ entries });
});

export { app };
