// Data-plane usage goes through the basin() accessor, which returns a scoped
// client the collector cannot verify. Only the `basin` call itself is
// attributable; the chained stream()/append() and any call on a scoped-client
// variable are deliberately dropped (documented builder-chain punt).
import { AppendInput, AppendRecord } from '@s2-dev/streamstore';
import { s2 } from '@/lib/s2';

export async function appendEvent(body: string) {
  return s2
    .basin('telemetry')
    .stream('events')
    .append(AppendInput.create([AppendRecord.string({ body })]));
}

export async function listStreams() {
  const basin = s2.basin('telemetry');
  // Scoped-client variable: streams.list here must NOT be attributed.
  return basin.streams.list({ prefix: 'events-' });
}
